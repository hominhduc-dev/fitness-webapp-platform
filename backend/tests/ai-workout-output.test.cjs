const assert = require('node:assert/strict')
const { test } = require('node:test')
const { normalizeAIWorkoutOutput } = require('../dist/lib/ai/workout-output.js')

const output = (exercise) => ({ workouts: [{ exercises: [exercise] }] })

test('recovers the reported legacy payload without mutating stored JSON', () => {
  const stored = output({ sets: 3, repsMin: 30, variationId: 'variation-1' })
  const normalized = normalizeAIWorkoutOutput(stored)
  assert.equal(normalized.workouts[0].exercises[0].reps, 30)
  assert.equal(normalized.workouts[0].exercises[0].variationId, 'variation-1')
  assert.equal(stored.workouts[0].exercises[0].reps, undefined)
})

test('preserves valid rep ranges and supports integer JSON strings', () => {
  const normalized = normalizeAIWorkoutOutput(output({ sets: '3', reps: '12', repsMin: '8' }))
  assert.deepEqual(normalized.workouts[0].exercises[0], { sets: 3, reps: 12, repsMin: 8 })
})

test('rejects missing, unsafe or ambiguous rep and set values with 422', () => {
  for (const exercise of [
    { sets: 3 }, { sets: 3, reps: 0 }, { sets: 3, reps: -2 },
    { sets: 3, reps: '30 giây' }, { sets: 3, reps: '8-12' },
    { sets: 3, reps: 1.5 }, { sets: 3, reps: Infinity },
    { sets: 3, reps: 2_147_483_648 }, { sets: 3, reps: 8, repsMin: 12 },
    { sets: 3, reps: false }, { sets: 3, reps: '', repsMin: 30 },
    { sets: 3, repsMin: -1 }, { sets: 51, reps: 10 }, { reps: 10 },
  ]) {
    assert.throws(() => normalizeAIWorkoutOutput(output(exercise)), (e) => e.status === 422)
  }
})

test('rejects malformed or empty workout collections', () => {
  for (const value of [null, {}, { workouts: [] }, { workouts: [null] }, output(null), output(null).workouts, { workouts: [{ exercises: [] }] }]) {
    assert.throws(() => normalizeAIWorkoutOutput(value), (e) => e.status === 422)
  }
})

// Exercise the service boundaries using isolated database/provider substitutes.
// These tests do not read .env, connect to a database, or call a remote model.
const db = {}
let provider
function stub(modulePath, exports) {
  const id = require.resolve(modulePath)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
stub('../dist/lib/prisma.js', { prisma: db, retryTransaction: (fn) => fn() })
stub('../dist/lib/ai/ai-client.js', { getAIProvider: () => provider })
stub('../dist/services/nutrition.service.js', { addMealItemForUser: () => assert.fail('unexpected meal write') })
const { acceptAIProgram, generateWorkoutProgram } = require('../dist/services/ai.service.js')
const profile = { id: 'user-1' }
function generation(exercise) {
  return { id: 'gen-1', userId: profile.id, type: 'workout_program', status: 'completed', output: { mapped: {
    name: 'Test', description: '', difficulty: 'beginner', duration: 1, workoutsPerWeek: 2,
    workouts: [{ name: 'Day 1', weekIndex: 0, scheduledDay: 1, duration: 30, exercises: [{ variationId: 'v1', ...exercise }] }],
  } } }
}

test('accept legacy generation writes three complete Prisma set records', async () => {
  const records = []
  const updates = []
  db.aIGeneration = { findUnique: async () => generation({ sets: 3, repsMin: 30 }) }
  db.$transaction = async (fn) => fn({
    program: { create: async () => {}, findUniqueOrThrow: async () => ({ id: 'saved-program' }) },
    programAssignment: { create: async () => {} }, workout: { create: async () => {} },
    workoutExercise: { create: async () => {} },
    exerciseSet: { createMany: async ({ data }) => records.push(...data) },
    aIGeneration: { update: async (data) => updates.push(data) },
  })
  const saved = await acceptAIProgram(profile, 'gen-1')
  assert.equal(saved.id, 'saved-program')
  assert.deepEqual(records.map((s) => [s.setNumber, s.targetReps, s.targetRepsMin]), [[1, 30, 30], [2, 30, 30], [3, 30, 30]])
  assert.equal(updates[0].data.status, 'accepted')
})

test('invalid persisted reps fail before opening a write transaction', async () => {
  db.aIGeneration = { findUnique: async () => generation({ sets: 3 }) }
  db.$transaction = () => assert.fail('must validate before any writes')
  await assert.rejects(acceptAIProgram(profile, 'gen-1'), (e) => e.status === 422)
})

test('rejects a meal generation at the workout accept endpoint', async () => {
  db.aIGeneration = { findUnique: async () => ({ ...generation({ sets: 3, reps: 10 }), type: 'meal_plan' }) }
  db.$transaction = () => assert.fail('must reject the wrong generation type')
  await assert.rejects(acceptAIProgram(profile, 'gen-1'), (e) => e.status === 400)
})

test('new invalid model output is marked failed, not left pending', async () => {
  const updates = []
  db.aIGeneration = { count: async () => 0, create: async () => ({ id: 'new-gen' }), update: async (args) => updates.push(args) }
  db.exercise = { findMany: async () => [{ id: 'e1', name: 'Squat', muscleGroup: 'legs', variations: [{ id: 'v1', name: 'Default', equipment: null }] }] }
  db.workoutLog = { findMany: async () => [] }
  provider = { generateStructuredJSON: async () => ({ data: output({ exerciseName: 'Squat', sets: 3 }), tokenUsage: 10 }) }
  await assert.rejects(generateWorkoutProgram(profile, { daysPerWeek: 2, durationWeeks: 1, goal: 'strength', experienceLevel: 'beginner', sessionDuration: 30, availableEquipment: 'bodyweight' }), (e) => e.status === 422)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].data.status, 'failed')
})
