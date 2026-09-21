/**
 * Folds trainee-personalized program copies back into the coach programs they
 * were forked from.
 *
 * A swap used to copy the coach's whole program, move the trainee's assignment
 * and logs onto the copy, and apply the change there. Swaps now record a
 * TraineeExerciseOverride against the coach's own row instead, so the copies
 * left behind are the last users of a model nothing else reads.
 *
 * Per copy this moves the trainee's assignment and log history back to the root
 * program, turns whatever the copy changed into override rows, and deletes the
 * copy. Copies whose trainee is gone are deleted outright; those are the
 * orphans the old re-forking bug produced.
 *
 * Order matters. WorkoutLog.workoutId is ON DELETE SET NULL and programId has
 * no foreign key at all, so deleting a copy before its logs are remapped would
 * silently sever them from their workout and leave them pointing at a program
 * id that no longer exists. Every copy is therefore remapped and deleted inside
 * one transaction.
 *
 *   npm --prefix backend run merge:forked-programs -- --dry-run
 *   npm --prefix backend run merge:forked-programs -- --apply
 *
 * Idempotent: a second run finds no copies left to fold.
 */
import { prisma } from "../lib/prisma"

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`)
}

/** Follows forkedFromProgramId to the coach's library entry, bounded against cycles. */
async function resolveRootProgramId(db: NonNullable<typeof prisma>, programId: string) {
  let currentId = programId

  for (let hop = 0; hop < 20; hop += 1) {
    const program = await db.program.findUnique({
      select: { forkedFromProgramId: true },
      where: { id: currentId },
    })

    if (!program?.forkedFromProgramId) return currentId
    currentId = program.forkedFromProgramId
  }

  throw new Error(`Fork chain from ${programId} did not terminate; refusing to guess a root.`)
}

/** A workout is matched to its counterpart by the slot a fork copies verbatim. */
function slotKey(workout: { scheduledDay: number | null; weekIndex: number | null }) {
  return `${workout.weekIndex ?? "null"}:${workout.scheduledDay ?? "null"}`
}

type CopyPlan =
  | { kind: "merge" }
  | { kind: "promote"; reason: string }
  | { kind: "deleteOrphan" }
  | { kind: "skip"; reason: string }

/**
 * Decides what to do with one personalized copy.
 *
 * Kept pure and separate from the writing below so the rule that matters — a
 * copy holding workout logs is never deleted, and is only ever merged when
 * there is a live program to merge it into — can be tested without a database.
 * Every branch that could lose history returns "skip" or "promote"; only
 * "merge" and "deleteOrphan" write anything destructive, and neither is reached
 * while logs are at risk.
 */
function planCopyAction(input: {
  assignmentCount: number
  isOwnRoot: boolean
  logCount: number
  rootExists: boolean
}): CopyPlan {
  if (input.assignmentCount === 0) {
    // Logs without a trainee to attribute them to: leave it for a human rather
    // than delete a program that still carries history.
    if (input.logCount > 0) return { kind: "skip", reason: `unassigned but holds ${input.logCount} logs` }
    return { kind: "deleteOrphan" }
  }

  if (input.assignmentCount > 1) {
    return { kind: "skip", reason: `${input.assignmentCount} assignments, expected one` }
  }

  // The fork pointer leads nowhere: either it points at itself, or the coach
  // deleted the original, which nothing prevents because forkedFromProgramId
  // carries no foreign key. Merging is impossible and deleting would destroy
  // the only copy of this trainee's plan and logs, so the copy is promoted to a
  // program of its own and left exactly where it is.
  if (input.isOwnRoot) return { kind: "promote", reason: "fork pointer resolves to itself" }
  if (!input.rootExists) return { kind: "promote", reason: "the original no longer exists" }

  return { kind: "merge" }
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const db = prisma
  const apply = hasFlag("apply")
  if (apply === hasFlag("dry-run")) throw new Error("Choose exactly one of --dry-run or --apply.")

  const copies = await db.program.findMany({
    include: {
      assignments: true,
      workouts: {
        include: { exercises: { orderBy: { order: "asc" } } },
        orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
    where: { forkedFromProgramId: { not: null } },
  })

  console.log(`Found ${copies.length} personalized ${copies.length === 1 ? "copy" : "copies"}.`)

  let merged = 0
  let promoted = 0
  let orphansDeleted = 0
  let overridesPlanned = 0
  let logsMoved = 0
  const skipped: string[] = []

  for (const copy of copies) {
    const logCount = await db.workoutLog.count({ where: { programId: copy.id } })
    const rootId = await resolveRootProgramId(db, copy.id)
    const isOwnRoot = rootId === copy.id
    const root = isOwnRoot
      ? null
      : await db.program.findUnique({
          include: {
            workouts: {
              include: { exercises: { orderBy: { order: "asc" } } },
              orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }],
            },
          },
          where: { id: rootId },
        })

    const plan = planCopyAction({
      assignmentCount: copy.assignments.length,
      isOwnRoot,
      logCount,
      rootExists: Boolean(root),
    })

    if (plan.kind === "skip") {
      skipped.push(`${copy.id} (${copy.name}): ${plan.reason}`)
      continue
    }

    if (plan.kind === "deleteOrphan") {
      console.log(`  orphan  ${copy.id}  ${copy.name}`)
      orphansDeleted += 1
      if (apply) await db.program.delete({ where: { id: copy.id } })
      continue
    }

    if (plan.kind === "promote") {
      // Nothing moves: one column, no deletion, no assignment reassigned, no
      // log touched. The trainee carries on against the same workout ids.
      console.log(`  promote ${copy.id}  ${copy.name}  (${plan.reason}; ${logCount} logs stay put)`)
      promoted += 1
      if (apply) {
        await db.program.update({ data: { forkedFromProgramId: null }, where: { id: copy.id } })
      }
      continue
    }

    const assignment = copy.assignments[0]
    if (!root) throw new Error(`Unreachable: merge planned for ${copy.id} without a root.`)

    const rootWorkoutBySlot = new Map(root.workouts.map((workout) => [slotKey(workout), workout]))

    const overrides: { replacedVariationId: string; variationId: string; workoutExerciseId: string }[] = []
    const workoutRemap: { fromWorkoutId: string; toWorkoutId: string }[] = []
    let unmatched = 0

    for (const copyWorkout of copy.workouts) {
      const rootWorkout = rootWorkoutBySlot.get(slotKey(copyWorkout))
      if (!rootWorkout) {
        unmatched += 1
        continue
      }

      workoutRemap.push({ fromWorkoutId: copyWorkout.id, toWorkoutId: rootWorkout.id })

      for (const copyExercise of copyWorkout.exercises) {
        // Order is the only stable identity across a fork: ids were regenerated
        // and the variation is exactly what may have changed.
        const rootExercise = rootWorkout.exercises.find((candidate) => candidate.order === copyExercise.order)
        if (!rootExercise) {
          unmatched += 1
          continue
        }
        if (rootExercise.variationId === copyExercise.variationId) continue

        overrides.push({
          replacedVariationId: rootExercise.variationId,
          variationId: copyExercise.variationId,
          workoutExerciseId: rootExercise.id,
        })
      }
    }

    if (unmatched > 0) {
      // Merging half a program would leave the trainee on the root with some of
      // their choices silently dropped. Better to leave it for a human.
      skipped.push(`${copy.id} (${copy.name}): ${unmatched} workouts/exercises have no counterpart in the root`)
      continue
    }

    console.log(
      `  merge   ${copy.id}  ${copy.name}  → ${rootId}  ` +
      `(${overrides.length} overrides, ${logCount} logs, trainee ${assignment.userId})`,
    )
    merged += 1
    overridesPlanned += overrides.length
    logsMoved += logCount

    if (!apply) continue

    await db.$transaction(async (tx) => {
      for (const remap of workoutRemap) {
        await tx.workoutLog.updateMany({
          data: { programId: rootId, workoutId: remap.toWorkoutId },
          where: { userId: assignment.userId, workoutId: remap.fromWorkoutId },
        })
      }

      // Logs that lost their workout link earlier still carry the copy's
      // programId; move them so nothing points at a program about to vanish.
      await tx.workoutLog.updateMany({
        data: { programId: rootId },
        where: { programId: copy.id },
      })

      for (const override of overrides) {
        await tx.traineeExerciseOverride.upsert({
          create: { ...override, userId: assignment.userId },
          update: { replacedVariationId: override.replacedVariationId, variationId: override.variationId },
          where: {
            userId_workoutExerciseId: {
              userId: assignment.userId,
              workoutExerciseId: override.workoutExerciseId,
            },
          },
        })
      }

      await tx.programAssignment.upsert({
        create: {
          assignedAt: assignment.assignedAt,
          programId: rootId,
          traineeGoogleSpreadsheetId: assignment.traineeGoogleSpreadsheetId,
          userId: assignment.userId,
        },
        update: {},
        where: { programId_userId: { programId: rootId, userId: assignment.userId } },
      })

      await tx.program.delete({ where: { id: copy.id } })
    })
  }

  console.log("")
  console.log(
    `${apply ? "Applied" : "Would apply"}: ${merged} merged, ${promoted} promoted, ` +
    `${orphansDeleted} orphans deleted,`,
  )
  console.log(`  ${overridesPlanned} override rows, ${logsMoved} logs moved.`)

  if (skipped.length > 0) {
    console.log("")
    console.log(`Skipped ${skipped.length} needing a look:`)
    for (const reason of skipped) console.log(`  - ${reason}`)
  }

  if (!apply) console.log("\nDry run. Re-run with --apply to write.")
}

if (require.main === module) {
  void main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma?.$disconnect()
    })
}

export { planCopyAction }
