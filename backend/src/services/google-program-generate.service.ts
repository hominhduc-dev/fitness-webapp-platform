import { batchUpdateSpreadsheet } from "../lib/google"
import { formatSetIntensityMethodCell, type SetIntensityAssignment } from "../domain/set-intensity-tag"
import { buildReferenceRows, WEEK_SHEET_TITLE } from "../domain/google-program-sheet"
import { BadRequestError } from "./errors"
import { assertCoachOwnsProgram } from "./fitness-data/core"
import { assertCoach, ensurePrisma } from "./fitness-data/shared/guards"
import { getGoogleAccessToken } from "./google-connection.service"
import {
  assertPlanDaysFitTemplate,
  buildProgramPlanRequests,
  findAmbiguousDisplayNames,
  type PlanDay,
  type PlanExercise,
} from "./google-program-plan.service"
import { createGoogleProgramTemplate } from "./google-program-template.service"
import type { SerializedProfile } from "./auth.service"

/** The shape the plan needs, structural so a test can hand it plain objects. */
export type SourceSet = {
  intensityTag: string | null
  rir: number | null
  setNumber: number
  targetReps: number
  targetRepsMin: number | null
  weight: number | null
}

export type SourceExercise = {
  notes: string | null
  order: number
  restTime: number | null
  sets: readonly SourceSet[]
  variation: {
    exercise: { muscleGroup: string; name: string }
    id: string
    isDefault: boolean
    name: string
  }
}

export type SourceWorkout = {
  exercises: readonly SourceExercise[]
  scheduledDate: Date | null
  scheduledDay: number | null
  weekIndex: number | null
}

/**
 * The name the `Exercise Table` tab lists this variation under.
 *
 * Must stay identical to the `name` `createGoogleProgramTemplate` builds its
 * reference rows from: the week grid resolves every other column by matching
 * this string, so a spelling that drifts from the reference tab leaves the
 * variation id blank and the sheet unable to export.
 */
export function variationDisplayName(variation: SourceExercise["variation"]) {
  return variation.isDefault ? variation.exercise.name : `${variation.exercise.name} (${variation.name})`
}

/**
 * The workouts that make up program week `weekIndex`, matching what the trainee
 * is shown: a week the coach did not author repeats the last authored week
 * before it.
 *
 * Workouts pinned to a calendar date are left out. They are one-off entries on
 * a trainee's schedule rather than part of a repeatable program, and the sheet
 * has nowhere to say "this row only applies to 12 March".
 */
export function selectProgramWeekWorkouts<T extends Pick<SourceWorkout, "scheduledDate" | "weekIndex">>(
  workouts: readonly T[],
  weekIndex: number,
): T[] {
  const recurring = workouts.filter((workout) => !workout.scheduledDate)
  if (recurring.length === 0) return []

  const authoredWeeks = [...new Set(recurring.map((workout) => Math.max(0, Math.round(workout.weekIndex ?? 0))))]
  const atOrBefore = authoredWeeks.filter((week) => week <= weekIndex)
  const effectiveWeek = atOrBefore.length > 0 ? Math.max(...atOrBefore) : Math.min(...authoredWeeks)

  return recurring.filter((workout) => Math.max(0, Math.round(workout.weekIndex ?? 0)) === effectiveWeek)
}

/**
 * One planned row per exercise, which is all the grid holds.
 *
 * Sets, reps, weight and RIR are read off the first set: the importer builds
 * every set of an exercise from that single row, so for a program that came
 * from a sheet the first set is the whole truth. A program built in the app can
 * prescribe a different weight per set, and that detail does not survive the
 * trip — the row records the opening set, not the ramp.
 */
function toPlanExercise(exercise: SourceExercise): PlanExercise {
  const [first] = exercise.sets
  const assignments = exercise.sets.flatMap((set) =>
    set.intensityTag ? [{ setNumber: set.setNumber, tag: set.intensityTag } as SetIntensityAssignment] : [],
  )

  return {
    displayName: variationDisplayName(exercise.variation),
    method: formatSetIntensityMethodCell(assignments, exercise.sets.length) || undefined,
    muscleGroup: exercise.variation.exercise.muscleGroup,
    notes: exercise.notes ?? undefined,
    reps: first ? (first.targetRepsMin ? `${first.targetRepsMin}-${first.targetReps}` : String(first.targetReps)) : undefined,
    restTime: exercise.restTime ?? undefined,
    rir: first?.rir ?? undefined,
    sets: exercise.sets.length || undefined,
    variationId: exercise.variation.id,
    variationName: exercise.variation.name,
    weight: first?.weight ?? undefined,
  }
}

/** Groups a week's workouts onto the days the grid lays out, in exercise order. */
export function toPlanDays(workouts: readonly SourceWorkout[]): PlanDay[] {
  const byDay = new Map<number, PlanExercise[]>()

  for (const workout of workouts) {
    if (!Number.isInteger(workout.scheduledDay)) continue

    const day = workout.scheduledDay!
    const exercises = [...workout.exercises].sort((left, right) => left.order - right.order).map(toPlanExercise)
    byDay.set(day, [...(byDay.get(day) ?? []), ...exercises])
  }

  return [...byDay.entries()]
    .sort(([left], [right]) => left - right)
    .map(([day, exercises]) => ({ day, exercises }))
}

/**
 * Every week of the program as sheet requests, against the tabs `sheetIdByWeek`
 * names. Built whole before anything is sent so a program the grid cannot hold
 * is refused before the spreadsheet has been half written.
 */
export function buildProgramSheetRequests(
  workouts: readonly SourceWorkout[],
  duration: number,
  sheetIdByWeek: ReadonlyMap<number, number>,
) {
  const ambiguousDisplayNames = findAmbiguousDisplayNames(
    workouts.flatMap((workout) => workout.exercises.map((exercise) => variationDisplayName(exercise.variation))),
  )
  const requests: unknown[] = []

  for (let weekIndex = 0; weekIndex < duration; weekIndex += 1) {
    const sheetId = sheetIdByWeek.get(weekIndex)
    if (sheetId == null) continue

    requests.push(
      ...buildProgramPlanRequests(sheetId, toPlanDays(selectProgramWeekWorkouts(workouts, weekIndex)), {
        ambiguousDisplayNames,
        weekTitle: `Week ${weekIndex + 1}`,
      }),
    )
  }

  return requests
}

/**
 * Turns a freshly created template into the program: one `Week N` tab per week,
 * each carrying that week's plan.
 *
 * Week 1 comes with the template and the rest are duplicates of it, so every
 * tab keeps the same formatting, dropdown and lookup formulas before its own
 * plan is written over the top.
 *
 * Takes the token rather than a profile because the same file is built in two
 * different Drives: the coach's, from their program page, and the trainee's,
 * the first time they export.
 */
export async function fillProgramWeeks(
  accessToken: string,
  created: { spreadsheetId: string; weekSheetId: number; weekSheetIndex: number },
  workouts: readonly SourceWorkout[],
  weeks: number,
) {
  const sheetIdByWeek = new Map<number, number>([[0, created.weekSheetId]])
  const duplicates = Array.from({ length: weeks - 1 }, (_, index) => ({
    duplicateSheet: {
      insertSheetIndex: created.weekSheetIndex + index + 1,
      newSheetName: `Week ${index + 2}`,
      sourceSheetId: created.weekSheetId,
    },
  }))

  if (duplicates.length > 0) {
    const response = await batchUpdateSpreadsheet(accessToken, created.spreadsheetId, duplicates)
    const replies = (response as { replies?: Array<{ duplicateSheet?: { properties?: { sheetId?: number } } }> })?.replies ?? []

    replies.forEach((reply, index) => {
      const sheetId = reply?.duplicateSheet?.properties?.sheetId
      if (sheetId != null) sheetIdByWeek.set(index + 1, sheetId)
    })
  }

  await batchUpdateSpreadsheet(
    accessToken,
    created.spreadsheetId,
    buildProgramSheetRequests(workouts, weeks, sheetIdByWeek),
  )
}

/**
 * The `Exercise Table` rows a program needs to stand on its own: every variation
 * it actually prescribes, and nothing else.
 *
 * A coach's template lists their whole library, because they author in it. A
 * trainee's copy only has to resolve the rows already written into it — and
 * listing the coach's full library there would hand one trainee the catalogue
 * their coach built for everyone.
 */
export function programReferenceRows(workouts: readonly SourceWorkout[]) {
  const byVariationId = new Map<string, Parameters<typeof buildReferenceRows>[0][number]>()

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      byVariationId.set(exercise.variation.id, {
        exerciseName: exercise.variation.exercise.name,
        id: exercise.variation.id,
        muscleGroup: exercise.variation.exercise.muscleGroup,
        name: variationDisplayName(exercise.variation),
        variationName: exercise.variation.name,
      })
    }
  }

  return buildReferenceRows([...byVariationId.values()])
}

/**
 * Gives a program built in the app the Google Sheet an imported one already has,
 * so its logs have somewhere to be exported to.
 *
 * The sheet is created in the coach's own Drive from the same template the
 * import flow expects, then filled week by week.
 *
 * Two requests racing each create a file before either claims the program, so
 * the id is taken with a conditional write and the loser returns the winner's
 * sheet. The loser's own file is left in Drive — harmless, but real, and worth
 * deleting here once `lib/google` can.
 */
export async function generateProgramSpreadsheet(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  assertCoach(profile)
  const program = await assertCoachOwnsProgram(profile.id, programId)

  if (program.googleSpreadsheetId) {
    throw new BadRequestError("Chương trình này đã gắn Google Sheet rồi.")
  }

  if (program.workouts.length === 0) {
    throw new BadRequestError("Chương trình chưa có buổi tập nào để đưa lên Google Sheet.")
  }

  const weeks = Math.max(1, Math.round(program.duration))

  // Creating the spreadsheet is the first thing that cannot be undone, so a plan
  // the grid will refuse has to be caught before it, not on the write after.
  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    assertPlanDaysFitTemplate(toPlanDays(selectProgramWeekWorkouts(program.workouts, weekIndex)))
  }

  const created = await createGoogleProgramTemplate(profile, { title: program.name })
  const token = await getGoogleAccessToken(profile)

  await fillProgramWeeks(token, created, program.workouts, weeks)

  const claimed = await db.program.updateMany({
    data: { googleSheetName: WEEK_SHEET_TITLE, googleSpreadsheetId: created.spreadsheetId },
    where: { googleSpreadsheetId: null, id: program.id },
  })

  if (!claimed.count) {
    const current = await db.program.findUnique({
      select: { googleSheetName: true, googleSpreadsheetId: true },
      where: { id: program.id },
    })

    return {
      created: false,
      sheetName: current?.googleSheetName ?? WEEK_SHEET_TITLE,
      spreadsheetId: current?.googleSpreadsheetId ?? created.spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${current?.googleSpreadsheetId ?? created.spreadsheetId}/edit`,
    }
  }

  return {
    created: true,
    sheetName: WEEK_SHEET_TITLE,
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  }
}
