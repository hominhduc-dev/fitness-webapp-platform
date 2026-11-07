import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "../auth.service"

type Where = Record<string, unknown>

const TRAINEE = "trainee-1"
const TODAY_PROGRAM = "11111111-1111-4111-8111-111111111111"
const OTHER_PROGRAM = "22222222-2222-4222-8222-222222222222"

const store = vi.hoisted(() => ({
  assignments: [] as Array<{ assignedAt: Date; hasWorkouts: boolean; programId: string; userId: string }>,
  checkIns: [] as Array<{ checkInDate: Date; muscles: unknown[]; readinessScore: number | null }>,
  logs: [] as Array<{ exerciseSnapshot: unknown; programId: string; startedAt: Date }>,
  programs: [] as Array<{ createdAt: Date; createdById: string; duration: number; goal: string | null; id: string; startDate: Date | null }>,
  recommendations: [] as Array<Record<string, unknown>>,
  today: null as null | { isCompleted: boolean; programId: string | null; workoutId: string; workoutName: string },
}))

const sameDay = (left: unknown, right: unknown) =>
  left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : left === right

/** The unique key (userId, programId, weekStart, muscleSlug), NULLS NOT DISTINCT as in the migration. */
function matchesKey(row: Record<string, unknown>, where: Where) {
  return (["userId", "programId", "weekStart", "muscleSlug"] as const)
    .every((field) => !(field in where) || sameDay(row[field] ?? null, where[field] ?? null))
}

const fakeDb = {
  muscleRegion: { count: async () => 1 },
  program: {
    findFirst: async ({ where }: { where: { id: string } }) => {
      const program = store.programs.find((entry) => entry.id === where.id)
      return program
        ? { ...program, assignments: store.assignments.filter((entry) => entry.programId === program.id) }
        : null
    },
  },
  programAssignment: {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      store.assignments
        .filter((entry) => entry.userId === where.userId && entry.hasWorkouts)
        .sort((left, right) => right.assignedAt.getTime() - left.assignedAt.getTime())[0] ?? null,
  },
  recoveryCheckIn: {
    findMany: async ({ where }: { where: { checkInDate: { gte: Date; lt: Date } } }) =>
      store.checkIns.filter((entry) => entry.checkInDate >= where.checkInDate.gte && entry.checkInDate < where.checkInDate.lt),
  },
  userMuscleVolumeProfile: { findMany: async () => [] },
  volumeRecommendation: {
    createMany: async ({ data, skipDuplicates }: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => {
      let count = 0
      for (const row of data) {
        if (store.recommendations.some((existing) => matchesKey(existing, row))) {
          if (!skipDuplicates) throw new Error("unique violation")
          continue
        }
        store.recommendations.push({ ...row, id: `rec-${store.recommendations.length + 1}` })
        count += 1
      }
      return { count }
    },
    findFirst: async ({ where }: { where: Where }) => store.recommendations.find((row) => matchesKey(row, where)) ?? null,
    findFirstOrThrow: async ({ where }: { where: Where }) => {
      const row = store.recommendations.find((entry) => matchesKey(entry, where))
      if (!row) throw new Error("not found")
      return row
    },
    findMany: async ({ where }: { where: Where }) => store.recommendations.filter((row) => matchesKey(row, where)),
    updateMany: async ({ data, where }: { data: Record<string, unknown>; where: Where }) => {
      const rows = store.recommendations.filter((row) => matchesKey(row, where))
      rows.forEach((row) => Object.assign(row, data))
      return { count: rows.length }
    },
  },
  workoutLog: {
    findMany: async ({ where }: { where: { programId?: string; startedAt: { gte: Date; lt: Date } } }) =>
      store.logs.filter((log) =>
        (where.programId == null || log.programId === where.programId)
        && log.startedAt >= where.startedAt.gte
        && log.startedAt < where.startedAt.lt,
      ),
  },
}

vi.mock("../fitness-data/core", () => ({
  findTodayScheduleEntryForTrainee: async () => store.today,
}))
vi.mock("../fitness-data/shared/guards", () => ({
  assertTrainee: () => undefined,
  ensurePrisma: () => fakeDb,
}))

import {
  getVolumeRecoveryForTrainee,
  setVolumeRecommendationStatusForTrainee,
} from "./volume-recovery.service"

const trainee = { fitnessGoals: [], id: TRAINEE, role: "trainee" } as unknown as SerializedProfile

function chestLog(programId: string, sets: number, day = "2026-11-03") {
  return {
    exerciseSnapshot: [{
      exercise: { id: "bench", muscleGroup: "Chest", name: "Bench Press" },
      sets: Array.from({ length: sets }, (_, index) => ({ actualReps: 8, completed: true, rir: 2, setNumber: index + 1, weight: 80 })),
      variation: { id: "bench-default", name: "Default", primaryMuscles: ["chest"], secondaryMuscles: [] },
    }],
    programId,
    startedAt: new Date(`${day}T08:00:00.000Z`),
  }
}

function program(id: string, startDate: string) {
  return { createdAt: new Date(startDate), createdById: "coach", duration: 8, goal: "hypertrophy", id, startDate: new Date(startDate) }
}

function chest(recovery: Awaited<ReturnType<typeof getVolumeRecoveryForTrainee>>) {
  const muscle = recovery.muscles.find((entry) => entry.muscleSlug === "chest")
  if (!muscle) throw new Error("no chest volume")
  return muscle
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-04T10:00:00.000Z"))
  // Week 4 of today's program, so it is past the baseline week. One chest set
  // there is below MEV; the other program carries enough sets that pooling
  // both would land in a different zone and a different action.
  store.programs = [program(TODAY_PROGRAM, "2026-10-12"), program(OTHER_PROGRAM, "2026-10-12")]
  store.assignments = [
    { assignedAt: new Date("2026-10-12T00:00:00.000Z"), hasWorkouts: true, programId: TODAY_PROGRAM, userId: TRAINEE },
    { assignedAt: new Date("2026-10-01T00:00:00.000Z"), hasWorkouts: true, programId: OTHER_PROGRAM, userId: TRAINEE },
  ]
  store.logs = [chestLog(TODAY_PROGRAM, 1), chestLog(OTHER_PROGRAM, 14)]
  store.checkIns = [{ checkInDate: new Date("2026-11-04T00:00:00.000Z"), muscles: [], readinessScore: 85 }]
  store.recommendations = []
  store.today = { isCompleted: false, programId: TODAY_PROGRAM, workoutId: "w1", workoutName: "Push" }
})

afterEach(() => {
  vi.useRealTimers()
})

describe("volume recovery program context", () => {
  it("gives the dashboard (no program) the same recommendation as the session for the same day", async () => {
    const dashboard = await getVolumeRecoveryForTrainee(trainee)
    const session = await getVolumeRecoveryForTrainee(trainee, undefined, TODAY_PROGRAM)

    expect(dashboard.programContext?.programId).toBe(TODAY_PROGRAM)
    expect(dashboard.muscles).toEqual(session.muscles)
    expect(dashboard.programContext).toEqual(session.programContext)
    // Only today's program's single set counts: below MEV and recovered.
    expect(chest(dashboard).recommendation).toMatchObject({ action: "increase", currentSets: 1, status: "pending" })
  })

  it("lets an explicit programId win over today's program", async () => {
    const other = await getVolumeRecoveryForTrainee(trainee, undefined, OTHER_PROGRAM)

    expect(other.programContext?.programId).toBe(OTHER_PROGRAM)
    expect(chest(other).recommendation.currentSets).toBe(14)
  })

  it("falls back to the newest assigned program with workouts on a day with no session", async () => {
    store.today = null
    store.assignments = [
      { assignedAt: new Date("2026-11-01T00:00:00.000Z"), hasWorkouts: false, programId: "empty", userId: TRAINEE },
      ...store.assignments,
    ]

    const dashboard = await getVolumeRecoveryForTrainee(trainee)

    expect(dashboard.programContext?.programId).toBe(TODAY_PROGRAM)
  })

  it("reports the baseline week as maintain on the dashboard too", async () => {
    store.programs = [program(TODAY_PROGRAM, "2026-11-02"), program(OTHER_PROGRAM, "2026-10-12")]

    const dashboard = await getVolumeRecoveryForTrainee(trainee)

    expect(dashboard.programContext).toMatchObject({ phase: "baseline", programId: TODAY_PROGRAM, programWeekIndex: 0 })
    expect(dashboard.muscles.every((muscle) => muscle.recommendation.action === "maintain")).toBe(true)
  })
})

describe("answering a volume recommendation", () => {
  it("stores the answer under the resolved program, and stops applying it once the action changes", async () => {
    await setVolumeRecommendationStatusForTrainee(trainee, { action: "increase", muscleSlug: "chest", status: "accepted" })

    expect(store.recommendations).toHaveLength(1)
    expect(store.recommendations[0]).toMatchObject({ action: "increase", programId: TODAY_PROGRAM, status: "accepted" })
    expect(chest(await getVolumeRecoveryForTrainee(trainee)).recommendation.status).toBe("accepted")

    // A poor check-in later the same week: no longer recovered, so the engine
    // now says maintain. The earlier "yes" was to a different question.
    store.checkIns = [{ checkInDate: new Date("2026-11-05T00:00:00.000Z"), muscles: [], readinessScore: 40 }, ...store.checkIns]
      .sort((left, right) => right.checkInDate.getTime() - left.checkInDate.getTime())
    const after = chest(await getVolumeRecoveryForTrainee(trainee)).recommendation

    expect(after).toMatchObject({ action: "maintain", status: "pending" })
  })

  it("refuses (409) an answer to an action that is no longer the one computed", async () => {
    await expect(
      setVolumeRecommendationStatusForTrainee(trainee, { action: "decrease", muscleSlug: "chest", status: "accepted" }),
    ).rejects.toMatchObject({ code: "VOLUME_RECOMMENDATION_CHANGED", status: 409 })
    expect(store.recommendations).toHaveLength(0)
  })

  it("keeps an answer from another program out of today's read", async () => {
    await setVolumeRecommendationStatusForTrainee(trainee, {
      action: "maintain", muscleSlug: "chest", programId: OTHER_PROGRAM, status: "dismissed",
    })

    expect(chest(await getVolumeRecoveryForTrainee(trainee)).recommendation.status).toBe("pending")
    expect(chest(await getVolumeRecoveryForTrainee(trainee, undefined, OTHER_PROGRAM)).recommendation.status).toBe("dismissed")
  })

  it("creates one row when the same answer is sent twice at once", async () => {
    const input = { action: "increase" as const, muscleSlug: "chest", status: "accepted" as const }

    const results = await Promise.all([
      setVolumeRecommendationStatusForTrainee(trainee, input),
      setVolumeRecommendationStatusForTrainee(trainee, input),
    ])

    expect(store.recommendations).toHaveLength(1)
    expect(results.map((result) => result.status)).toEqual(["accepted", "accepted"])
  })

  it("updates the one row when a later answer replaces an earlier one", async () => {
    await setVolumeRecommendationStatusForTrainee(trainee, { action: "increase", muscleSlug: "chest", status: "accepted" })
    await setVolumeRecommendationStatusForTrainee(trainee, { action: "increase", muscleSlug: "chest", status: "applied" })

    expect(store.recommendations).toHaveLength(1)
    expect(store.recommendations[0]).toMatchObject({ status: "applied" })
    expect(store.recommendations[0].acceptedAt).toBeInstanceOf(Date)
  })
})
