/** Real PostgreSQL contention test. Creates/deletes only UUID-scoped fixtures.
 * Run from backend: npx tsx src/scripts/test-exercise-swap-postgres.ts [iterations]
 * Uses the already-open development database tunnel; never starts a scheduler.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import dotenv from "dotenv"
import { Prisma, PrismaClient, UserRole } from "@prisma/client"
import type { SerializedProfile } from "../services/auth.service"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

const ids = {
  coach: randomUUID(), trainee: randomUUID(), replacement: randomUUID(),
  exercise: randomUUID(), old: randomUUID(), next: randomUUID(), edited: randomUUID(),
  program: randomUUID(), current: randomUUID(), future: randomUUID(),
  currentSlot: randomUUID(), futureSlot: randomUUID(), notification: randomUUID(),
}
const users = [ids.coach, ids.trainee, ids.replacement]
const iterations = Number(process.argv[2] ?? 3)
assert(Number.isInteger(iterations) && iterations >= 1 && iterations <= 20, "iterations must be 1..20")
const config = dotenv.parse(readFileSync(resolve(process.cwd(), ".env")))
for (const [key, value] of Object.entries(config)) process.env[key] ??= value
process.env.ENV_SKIP_DOTENV = "1"
process.env.NODE_ENV = "test"
process.env.PRISMA_SLOW_QUERY_MS = "0"
const url = new URL(process.env.DATABASE_URL ?? "")
assert(["postgres:", "postgresql:"].includes(url.protocol), "PostgreSQL is required")
url.searchParams.set("connection_limit", "10")
url.searchParams.set("pool_timeout", "30")
const db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] })

type Barrier = { model: "notification" | "program"; entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred>; armed: boolean }
let barrier: Barrier | undefined
let conflicts = 0
const operations: Promise<unknown>[] = []
// Only intercept transaction read timing. Every read/write/commit still runs
// against PostgreSQL through the real Prisma client and production services.
const instrumented = new Proxy(db, {
  get(target, property) {
    if (property === "$transaction") return async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }) => {
      try {
        return await target.$transaction(async (tx) => {
          const wrapped = new Proxy(tx, {
            get(client, model) {
              const delegate = Reflect.get(client, model)
              if (model !== "notification" && model !== "program") return delegate
              return new Proxy(delegate, {
                get(modelDelegate, method) {
                  const original = Reflect.get(modelDelegate, method)
                  if (method !== "findFirst") return typeof original === "function" ? original.bind(modelDelegate) : original
                  return async (args: unknown) => {
                    const result = await original.call(modelDelegate, args)
                    const active = barrier
                    if (active?.armed && active.model === model && result?.id === (model === "notification" ? ids.notification : ids.program)) {
                      active.armed = false
                      active.entered.resolve()
                      await active.release.promise
                    }
                    return result
                  }
                },
              })
            },
          })
          return callback(wrapped)
        }, { ...options, maxWait: 15_000, timeout: 30_000 })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") conflicts++
        throw error
      }
    }
    const original = Reflect.get(target, property)
    return typeof original === "function" ? original.bind(target) : original
  },
})
;(globalThis as { prisma?: PrismaClient }).prisma = instrumented

const coach = { id: ids.coach, name: "Swap integration fixture", role: UserRole.coach } as SerializedProfile
const metadata: Prisma.InputJsonObject = {
  kind: "trainee_swapped_exercise", newVariationId: ids.next, oldVariationId: ids.old,
  originalProgramId: ids.program, personalizedProgramId: ids.program,
  originalWorkoutId: ids.current, targetOrder: 0, traineeId: ids.trainee,
  workoutScheduledDay: 0, workoutWeekIndex: 0,
}

async function reset() {
  await db.$transaction(async (tx) => {
    await tx.programAssignment.deleteMany({ where: { programId: ids.program } })
    await tx.programAssignment.create({ data: { programId: ids.program, userId: ids.trainee } })
    await tx.workoutExercise.updateMany({ where: { id: { in: [ids.currentSlot, ids.futureSlot] } }, data: { variationId: ids.old, originalVariationId: null } })
    await tx.notification.update({ where: { id: ids.notification }, data: { metadata, readAt: new Date() } })
  })
}

async function remainingFixtures() {
  return (await Promise.all([
    db.user.count({ where: { id: { in: users } } }),
    db.program.count({ where: { id: ids.program } }),
    db.exercise.count({ where: { id: ids.exercise } }),
    db.variation.count({ where: { id: { in: [ids.old, ids.next, ids.edited] } } }),
    db.workout.count({ where: { id: { in: [ids.current, ids.future] } } }),
    db.workoutExercise.count({ where: { id: { in: [ids.currentSlot, ids.futureSlot] } } }),
    db.programAssignment.count({ where: { programId: ids.program } }),
    db.notification.count({ where: { id: ids.notification } }),
  ])).reduce((total, count) => total + count, 0)
}

async function main() {
  const results: { case: string; iterations: number; conflicts: number }[] = []
  try {
    await db.$connect()
    console.log(JSON.stringify({ target: { host: url.hostname, port: url.port || "5432", database: url.pathname.slice(1) }, iterations }))
    await db.user.createMany({ data: users.map((id, index) => ({ id, name: "Swap integration fixture", email: `swap-${id}@example.invalid`, isActive: false, role: index === 0 ? UserRole.coach : UserRole.trainee })) })
    await db.exercise.create({ data: { id: ids.exercise, name: "Swap integration fixture", muscleGroup: "Back", createdById: ids.coach, variations: { create: [ids.old, ids.next, ids.edited].map((id) => ({ id, name: id })) } } })
    await db.program.create({ data: { id: ids.program, name: "Swap integration fixture", duration: 2, difficulty: "beginner", workoutsPerWeek: 1, createdById: ids.coach,
      assignments: { create: { userId: ids.trainee } },
      workouts: { create: [ids.current, ids.future].map((id, weekIndex) => ({ id, name: "Fixture day", weekIndex, scheduledDay: 0, exercises: { create: { id: weekIndex === 0 ? ids.currentSlot : ids.futureSlot, order: 0, variationId: ids.old } } })) },
    } })
    await db.notification.create({ data: { id: ids.notification, userId: ids.coach, type: "general", status: "sent", channel: "in_app", title: "Integration fixture", message: "Integration fixture", metadata, readAt: new Date(), scheduledFor: new Date("2099-01-01"), sentAt: new Date() } })
    const { approveTraineeExerciseSwapForCoach: approve, rejectTraineeExerciseSwapForCoach: reject } = await import("../services/fitness-data/core.js")

    for (const testCase of ["reject-first", "approve-first", "supersede-first", "coach-edit-first", "stale-assignment"] as const) {
      const initialConflicts = conflicts
      for (let iteration = 0; iteration < iterations; iteration++) {
        const iterationConflicts = conflicts
        await reset()
        if (testCase === "stale-assignment") {
          await db.$transaction(async (tx) => {
            await tx.programAssignment.deleteMany({ where: { programId: ids.program, userId: ids.trainee } })
            await tx.programAssignment.create({ data: { programId: ids.program, userId: ids.replacement } })
          })
          await assert.rejects(approve(coach, ids.notification), { name: "AuthServiceError", status: 409 })
        } else {
          barrier = { model: testCase === "approve-first" ? "notification" : "program", entered: deferred(), release: deferred(), armed: true }
          const active = barrier
          const loser = (testCase === "approve-first" ? reject(coach, ids.notification) : approve(coach, ids.notification)).then(() => ({ error: undefined as unknown }), (error: unknown) => ({ error }))
          operations.push(loser)
          const timeout = setTimeout(() => active.release.resolve(), 20_000)
          try {
            await Promise.race([active.entered.promise, new Promise<never>((_, fail) => { setTimeout(() => fail(new Error("barrier timed out")), 15_000).unref() })])
            if (testCase === "reject-first") await reject(coach, ids.notification)
            if (testCase === "approve-first") await approve(coach, ids.notification)
            if (testCase === "supersede-first") await db.$transaction(async (tx) => {
              const current = await tx.notification.findUniqueOrThrow({ where: { id: ids.notification } })
              await tx.notification.update({ where: { id: ids.notification }, data: { metadata: { ...(current.metadata as Prisma.JsonObject), supersededAt: new Date().toISOString(), supersededByNotificationId: randomUUID() } } })
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
            if (testCase === "coach-edit-first") await db.workoutExercise.update({ where: { id: ids.futureSlot }, data: { variationId: ids.edited } })
            active.release.resolve()
            const { error } = await loser
            assert(error instanceof Error, "stale decision must fail after retry")
            assert.equal(error.name, "AuthServiceError")
            assert.equal((error as Error & { status: number }).status, 409)
            assert(conflicts > iterationConflicts, "Each overlap must produce a genuine PostgreSQL P2034")
          } finally {
            clearTimeout(timeout)
            active.release.resolve()
            await loser
            barrier = undefined
          }
        }
        const saved = await db.notification.findUniqueOrThrow({ where: { id: ids.notification } })
        const savedMetadata = saved.metadata as Prisma.JsonObject
        const slot = await db.workoutExercise.findUniqueOrThrow({ where: { id: ids.futureSlot } })
        if (testCase === "approve-first") {
          assert.equal(slot.variationId, ids.next)
          assert(savedMetadata.approvedAt)
          assert.equal(savedMetadata.rejectedAt, undefined)
        } else {
          assert.equal(slot.variationId, testCase === "coach-edit-first" ? ids.edited : ids.old)
          assert.equal(savedMetadata.approvedAt, undefined)
          if (testCase === "supersede-first") assert(savedMetadata.supersededAt)
          if (testCase === "stale-assignment") assert.equal(savedMetadata.rejectionReason, "trainee_no_longer_assigned")
          if (testCase === "coach-edit-first") assert.equal(savedMetadata.rejectionReason, "missing_future_workout")
          if (testCase === "reject-first") assert(savedMetadata.rejectedAt)
        }
      }
      results.push({ case: testCase, iterations, conflicts: conflicts - initialConflicts })
      console.log(JSON.stringify(results.at(-1)))
      if (testCase !== "stale-assignment") assert(conflicts > initialConflicts, "Expected a genuine PostgreSQL P2034")
    }
    console.log(JSON.stringify({ passed: results.length * iterations, conflicts }))
  } finally {
    barrier?.release.resolve()
    await Promise.allSettled(operations)
    try {
      await db.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { id: ids.notification } })
        await tx.program.deleteMany({ where: { id: ids.program } })
        await tx.exercise.deleteMany({ where: { id: ids.exercise } })
        await tx.user.deleteMany({ where: { id: { in: users } } })
      }, { timeout: 30_000 })
      const remaining = await remainingFixtures()
      console.log(JSON.stringify({ remainingFixtureRows: remaining }))
      assert.equal(remaining, 0, "Fixture cleanup must be complete")
    } finally {
      await db.$disconnect()
    }
  }
}

main().catch((error: unknown) => {
  // Never print Prisma's full invocation/connection diagnostics or credentials.
  console.error(JSON.stringify({ failed: true, code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof assert.AssertionError ? "ASSERTION" : "HARNESS_ERROR" }))
  process.exitCode = 1
})
