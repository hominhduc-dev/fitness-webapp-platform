/**
 * Backfills Exercise.movementPattern with the AI classifier.
 *
 *   npm run classify:movement-patterns -- --dry-run [--limit 100] [--report path]
 *     Classifies every exercise still without a pattern and writes a report.
 *     Reads the database only; re-running resumes from the report.
 *
 *   npm run classify:movement-patterns -- --apply [--report path]
 *     Writes the reviewed report to the database. No AI calls. Only rows that
 *     are still null are touched, so a pattern a coach or admin set since the
 *     dry run is never overwritten.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import { movementPatternSchema, type MovementPatternValue } from "../domain/movement-pattern"
import { classifyMovementPatterns, type MovementPatternInputRow } from "../domain/movement-pattern-classifier"
import { getAIProvider } from "../lib/ai/ai-client"
import { invalidateExerciseLibrary } from "../lib/library-cache"
import { prisma } from "../lib/prisma"

type ReportRow = { exerciseId: string; name: string; movementPattern: MovementPatternValue }
type Report = { failures: Array<{ exerciseId: string; name: string }>; results: ReportRow[] }

const BATCH_SIZE = 40

function readArg(name: string) {
  const args = process.argv.slice(2)
  const exact = args.indexOf(`--${name}`)
  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  return inline?.slice(name.length + 3) ?? (exact >= 0 ? args[exact + 1] : undefined)
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`)
}

async function readReport(reportPath: string): Promise<Report> {
  try {
    const parsed = JSON.parse(await readFile(reportPath, "utf8")) as Partial<Report>
    return { failures: parsed.failures ?? [], results: parsed.results ?? [] }
  } catch {
    return { failures: [], results: [] }
  }
}

async function writeReport(reportPath: string, report: Report) {
  const counts: Record<string, number> = {}
  for (const row of report.results) counts[row.movementPattern] = (counts[row.movementPattern] ?? 0) + 1
  const payload = { ...report, generatedAt: new Date().toISOString(), summary: { classified: report.results.length, failed: report.failures.length, patterns: counts } }

  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(`${reportPath}.tmp`, JSON.stringify(payload, null, 2), "utf8")
  await rename(`${reportPath}.tmp`, reportPath)
}

async function dryRun(reportPath: string, limit: number) {
  const db = prisma!
  const report = await readReport(reportPath)
  const done = new Set(report.results.map((row) => row.exerciseId))
  // Failures are retried on the next run.
  report.failures = []

  const exercises = (await db.exercise.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      muscleGroup: true,
      name: true,
      variations: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        select: { activityType: true, equipment: true, muscleTargets: { orderBy: { position: "asc" }, select: { muscleSlug: true, role: true } } },
      },
    },
    where: { movementPattern: null },
  })).filter((exercise) => !done.has(exercise.id)).slice(0, limit)

  const provider = getAIProvider()
  let tokens = 0
  for (let start = 0; start < exercises.length; start += BATCH_SIZE) {
    const batch = exercises.slice(start, start + BATCH_SIZE)
    const rows: MovementPatternInputRow[] = batch.map((exercise) => {
      const main = exercise.variations[0]
      return {
        activityType: main?.activityType ?? null,
        equipment: [...new Set(exercise.variations.map((variation) => variation.equipment).filter((value): value is string => Boolean(value)))],
        exerciseId: exercise.id,
        muscleGroup: exercise.muscleGroup,
        name: exercise.name,
        primaryMuscles: main?.muscleTargets.filter((target) => target.role === "primary").map((target) => target.muscleSlug) ?? [],
      }
    })

    const names = new Map(batch.map((exercise) => [exercise.id, exercise.name]))
    try {
      const result = await classifyMovementPatterns(provider, rows)
      tokens += result.tokenUsage
      report.results.push(...result.classifications.map((row) => ({ ...row, name: names.get(row.exerciseId) ?? "" })))
      report.failures.push(...result.failedIds.map((exerciseId) => ({ exerciseId, name: names.get(exerciseId) ?? "" })))
    } catch (error) {
      report.failures.push(...batch.map((exercise) => ({ exerciseId: exercise.id, name: exercise.name })))
      process.stderr.write(`batch ${start / BATCH_SIZE + 1} failed: ${error instanceof Error ? error.message : String(error)}\n`)
    }

    // Saved after every batch so an interrupted run loses at most one batch.
    await writeReport(reportPath, report)
    process.stdout.write(`${Math.min(start + BATCH_SIZE, exercises.length)}/${exercises.length} exercises, ${tokens} tokens\n`)
  }

  process.stdout.write(`Report: ${reportPath}\n`)
}

async function apply(reportPath: string) {
  const db = prisma!
  const { results } = await readReport(reportPath)
  if (results.length === 0) throw new Error(`No classified rows in ${reportPath}; run --dry-run first.`)

  const byPattern = new Map<MovementPatternValue, string[]>()
  for (const row of results) {
    const pattern = movementPatternSchema.parse(row.movementPattern)
    byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), row.exerciseId])
  }

  let updated = 0
  await db.$transaction(async (transaction) => {
    for (const [movementPattern, ids] of byPattern) {
      const result = await transaction.exercise.updateMany({ data: { movementPattern }, where: { id: { in: ids }, movementPattern: null } })
      updated += result.count
    }
  })
  invalidateExerciseLibrary()
  process.stdout.write(`Applied ${updated} of ${results.length} classified exercises (the rest already had a pattern).\n`)
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const applyMode = hasFlag("apply")
  if (applyMode === hasFlag("dry-run")) throw new Error("Choose exactly one of --dry-run or --apply.")

  const reportPath = path.resolve(process.cwd(), readArg("report") ?? "../outputs/movement-pattern-dry-run.json")
  if (applyMode) {
    await apply(reportPath)
  } else {
    await dryRun(reportPath, Math.max(1, Number(readArg("limit") ?? Number.MAX_SAFE_INTEGER)))
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(async () => prisma?.$disconnect())
