import type { Prisma } from "@prisma/client"

import {
  DAY_IN_MS,
  formatMonthDayLabel,
  formatWeekdayLabel,
  startOfUtcWeek,
  toUtcDayStart,
} from "./dates"
import {
  getSnapshotExerciseName,
  getSnapshotMaxWeight,
  getSnapshotMuscleGroup,
  parseWorkoutLogSnapshotExercises,
} from "./workout-snapshot"

/**
 * Pure aggregations behind the trainee progress screen.
 *
 * Every function here takes already-fetched `WorkoutLog` rows and returns plain
 * data — no Prisma access, no auth, no I/O. That keeps the analytics independently
 * testable and means adding a chart never widens the service's database surface.
 */

type ProgressAnalyticsLogRecord = {
  exerciseSnapshot: Prisma.JsonValue | null
  startedAt: Date
  totalVolume: number | null
}


const PROGRESS_SERIES_COLORS = ["#22C55E", "#2563EB", "#F43F5E"]
const PROGRESS_PIE_COLORS = ["#2563EB", "#22C55E", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4"]

function calculateWorkoutVolume(exercises: Array<{ sets?: Array<{ actualReps?: number; completed?: boolean; targetReps?: number; weight?: number }> }>) {
  return exercises.reduce((volumeTotal, exercise) => {
    const setVolume = (exercise.sets ?? []).reduce((setTotal, set) => {
      if (!set.completed || !set.weight) {
        return setTotal
      }

      const reps = set.actualReps ?? set.targetReps ?? 0
      return setTotal + set.weight * reps
    }, 0)

  return volumeTotal + setVolume
  }, 0)
}




function calculateWorkoutStreaks(logs: ProgressAnalyticsLogRecord[]) {
  const workoutDays = Array.from(new Set(logs.map((log) => toUtcDayStart(log.startedAt)))).sort((left, right) => left - right)

  if (workoutDays.length === 0) {
    return {
      bestStreakDays: 0,
      currentStreakDays: 0,
    }
  }

  let bestStreakDays = 1
  let runningStreak = 1

  for (let index = 1; index < workoutDays.length; index += 1) {
    if (workoutDays[index] - workoutDays[index - 1] === DAY_IN_MS) {
      runningStreak += 1
    } else {
      runningStreak = 1
    }

    bestStreakDays = Math.max(bestStreakDays, runningStreak)
  }

  let currentStreakDays = 0
  const latestWorkoutDay = workoutDays[workoutDays.length - 1]
  const today = toUtcDayStart(new Date())

  if (today - latestWorkoutDay <= DAY_IN_MS) {
    currentStreakDays = 1

    for (let index = workoutDays.length - 1; index > 0; index -= 1) {
      if (workoutDays[index] - workoutDays[index - 1] !== DAY_IN_MS) {
        break
      }

      currentStreakDays += 1
    }
  }

  return {
    bestStreakDays,
    currentStreakDays,
  }
}

function buildWeeklyVolume(logs: ProgressAnalyticsLogRecord[]) {
  const today = toUtcDayStart(new Date())
  const startDay = today - 6 * DAY_IN_MS
  const totalsByDay = new Map<number, number>()

  logs.forEach((log) => {
    const dayStart = toUtcDayStart(log.startedAt)

    if (dayStart < startDay || dayStart > today) {
      return
    }

    totalsByDay.set(dayStart, (totalsByDay.get(dayStart) ?? 0) + (log.totalVolume ?? 0))
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const dayStart = startDay + index * DAY_IN_MS

    return {
      day: formatWeekdayLabel(new Date(dayStart)),
      volume: Math.round((totalsByDay.get(dayStart) ?? 0) * 10) / 10,
    }
  })
}

function buildMuscleGroupDistribution(logs: ProgressAnalyticsLogRecord[]) {
  const muscleGroupCounts = new Map<string, number>()

  logs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const muscleGroup = getSnapshotMuscleGroup(exercise)

      if (!muscleGroup) {
        return
      }

      muscleGroupCounts.set(muscleGroup, (muscleGroupCounts.get(muscleGroup) ?? 0) + 1)
    })
  })

  const totalExercises = Array.from(muscleGroupCounts.values()).reduce((sum, count) => sum + count, 0)

  if (totalExercises === 0) {
    return [] as Array<{ fill: string; name: string; value: number }>
  }

  return Array.from(muscleGroupCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count], index) => ({
      fill: PROGRESS_PIE_COLORS[index % PROGRESS_PIE_COLORS.length],
      name,
      value: Math.round((count / totalExercises) * 100),
    }))
}

function buildPersonalRecords(logs: ProgressAnalyticsLogRecord[]) {
  const recordByExercise = new Map<string, { date: Date; weight: number }>()

  logs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const weight = getSnapshotMaxWeight(exercise)

      if (!exerciseName || weight == null) {
        return
      }

      const existingRecord = recordByExercise.get(exerciseName)

      if (
        !existingRecord ||
        weight > existingRecord.weight ||
        (weight === existingRecord.weight && log.startedAt.getTime() > existingRecord.date.getTime())
      ) {
        recordByExercise.set(exerciseName, {
          date: log.startedAt,
          weight,
        })
      }
    })
  })

  return Array.from(recordByExercise.entries())
    .map(([exercise, record]) => ({
      date: record.date,
      exercise,
      weight: record.weight,
    }))
    .sort((left, right) => right.weight - left.weight || right.date.getTime() - left.date.getTime())
    .slice(0, 4)
}

function buildStrengthProgression(logs: ProgressAnalyticsLogRecord[]) {
  const currentWeekStart = startOfUtcWeek(new Date())
  const weekStarts = Array.from({ length: 6 }, (_value, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - (5 - index) * 7)
    return weekStart
  })

  const firstWeekStart = weekStarts[0]?.getTime() ?? 0
  const weeklyExerciseMax = new Map<string, Map<string, number>>()

  logs.forEach((log) => {
    const weekStart = startOfUtcWeek(log.startedAt)

    if (weekStart.getTime() < firstWeekStart) {
      return
    }

    const weekKey = weekStart.toISOString().slice(0, 10)
    const weekBucket = weeklyExerciseMax.get(weekKey) ?? new Map<string, number>()

    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const weight = getSnapshotMaxWeight(exercise)

      if (!exerciseName || weight == null) {
        return
      }

      weekBucket.set(exerciseName, Math.max(weekBucket.get(exerciseName) ?? 0, weight))
    })

    weeklyExerciseMax.set(weekKey, weekBucket)
  })

  const exerciseCandidates = new Map<string, { maxWeight: number; occurrences: number }>()

  weeklyExerciseMax.forEach((weekBucket) => {
    weekBucket.forEach((weight, exerciseName) => {
      const current = exerciseCandidates.get(exerciseName)

      if (!current) {
        exerciseCandidates.set(exerciseName, {
          maxWeight: weight,
          occurrences: 1,
        })
        return
      }

      exerciseCandidates.set(exerciseName, {
        maxWeight: Math.max(current.maxWeight, weight),
        occurrences: current.occurrences + 1,
      })
    })
  })

  const series = Array.from(exerciseCandidates.entries())
    .sort((left, right) => {
      const occurrenceDelta = right[1].occurrences - left[1].occurrences

      if (occurrenceDelta !== 0) {
        return occurrenceDelta
      }

      return right[1].maxWeight - left[1].maxWeight
    })
    .slice(0, PROGRESS_SERIES_COLORS.length)
    .map(([exerciseName], index) => ({
      color: PROGRESS_SERIES_COLORS[index],
      exerciseName,
      key: `series${index + 1}`,
    }))

  const points = weekStarts.map((weekStart) => {
    const weekKey = weekStart.toISOString().slice(0, 10)
    const weekBucket = weeklyExerciseMax.get(weekKey) ?? new Map<string, number>()

    return {
      label: formatMonthDayLabel(weekStart),
      values: Object.fromEntries(series.map((item) => [item.key, weekBucket.get(item.exerciseName) ?? null])),
    }
  })

  return {
    points,
    series,
  }
}


export {
  buildMuscleGroupDistribution,
  buildPersonalRecords,
  buildStrengthProgression,
  buildWeeklyVolume,
  calculateWorkoutStreaks,
  calculateWorkoutVolume,
  PROGRESS_PIE_COLORS,
  PROGRESS_SERIES_COLORS,
}
export type { ProgressAnalyticsLogRecord }
