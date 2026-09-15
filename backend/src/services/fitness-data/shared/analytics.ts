import type { Prisma } from "@prisma/client"

import {
  clientCalendarDay,
  DAY_IN_MS,
  formatMonthDayLabel,
  formatWeekdayLabel,
  startOfUtcWeek,
} from "./dates"
import {
  getSnapshotExerciseName,
  getSnapshotExerciseVolume,
  getSnapshotMaxE1RM,
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

type DashboardLogRecord = ProgressAnalyticsLogRecord & {
  completedAt: Date | null
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
  // Streaks are counted in the client's calendar days.
  const workoutDays = Array.from(new Set(logs.map((log) => clientCalendarDay(log.startedAt).getTime()))).sort((left, right) => left - right)

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
  const today = clientCalendarDay().getTime()

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
  const today = clientCalendarDay().getTime()
  const startDay = today - 6 * DAY_IN_MS
  const totalsByDay = new Map<number, number>()

  logs.forEach((log) => {
    const dayStart = clientCalendarDay(log.startedAt).getTime()

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

function buildMuscleGroupDistribution(
  logs: ProgressAnalyticsLogRecord[],
  mode: "count" | "volume" = "count",
) {
  const muscleGroupValues = new Map<string, number>()

  logs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const muscleGroup = getSnapshotMuscleGroup(exercise)

      if (!muscleGroup) {
        return
      }

      if (mode === "volume") {
        const exerciseVolume = getSnapshotExerciseVolume(exercise)
        muscleGroupValues.set(muscleGroup, (muscleGroupValues.get(muscleGroup) ?? 0) + exerciseVolume)
      } else {
        muscleGroupValues.set(muscleGroup, (muscleGroupValues.get(muscleGroup) ?? 0) + 1)
      }
    })
  })

  const total = Array.from(muscleGroupValues.values()).reduce((sum, v) => sum + v, 0)

  if (total === 0) {
    return { groups: [] as Array<{ fill: string; name: string; value: number; volume: number }>, totalVolume: 0 }
  }

  const groups = Array.from(muscleGroupValues.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, rawValue], index) => ({
      fill: PROGRESS_PIE_COLORS[index % PROGRESS_PIE_COLORS.length],
      name,
      value: Math.round((rawValue / total) * 100),
      volume: mode === "volume" ? Math.round(rawValue) : 0,
    }))

  return {
    groups,
    totalVolume: mode === "volume" ? Math.round(total) : 0,
  }
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
  const currentWeekStart = startOfUtcWeek(clientCalendarDay())
  const weekStarts = Array.from({ length: 6 }, (_value, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - (5 - index) * 7)
    return weekStart
  })

  const firstWeekStart = weekStarts[0]?.getTime() ?? 0
  const weeklyExerciseMax = new Map<string, Map<string, number>>()

  logs.forEach((log) => {
    const weekStart = startOfUtcWeek(clientCalendarDay(log.startedAt))

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


// ---------------------------------------------------------------------------
// Dashboard analytics builders
// ---------------------------------------------------------------------------

/**
 * Group workout logs into weekly buckets and count completed vs planned.
 * `workoutsPerWeek` comes from the active program; 0 means no active program.
 */
function buildWorkoutFrequency(
  logs: ProgressAnalyticsLogRecord[],
  startDate: Date,
  endDate: Date,
  workoutsPerWeek: number,
) {
  const weekBuckets = new Map<string, { completed: number; end: Date; start: Date }>()
  // startDate and endDate are instants; the weeks are the client's calendar weeks between them.
  let cursor = startOfUtcWeek(clientCalendarDay(startDate))
  let weekIndex = 0
  const lastDay = clientCalendarDay(endDate).getTime()

  while (cursor.getTime() <= lastDay) {
    const weekEnd = new Date(cursor)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    weekIndex += 1
    const key = `W${weekIndex}`

    weekBuckets.set(key, { completed: 0, end: weekEnd, start: new Date(cursor) })
    cursor = weekEnd
  }

  logs.forEach((log) => {
    const logDay = clientCalendarDay(log.startedAt).getTime()

    weekBuckets.forEach((bucket) => {
      if (logDay >= bucket.start.getTime() && logDay < bucket.end.getTime()) {
        bucket.completed += 1
      }
    })
  })

  const planned = workoutsPerWeek > 0 ? Math.round(workoutsPerWeek) : 0

  return Array.from(weekBuckets.entries()).map(([key, bucket]) => ({
    completed: bucket.completed,
    label: `${key}\n${formatMonthDayLabel(bucket.start)}-${formatMonthDayLabel(new Date(bucket.end.getTime() - DAY_IN_MS))}`,
    planned,
  }))
}

/**
 * Total training volume grouped by week for an arbitrary date range.
 */
function buildTrainingVolumeByWeek(
  logs: ProgressAnalyticsLogRecord[],
  startDate: Date,
  endDate: Date,
) {
  const weekBuckets = new Map<string, { end: Date; start: Date; volume: number }>()
  // startDate and endDate are instants; the weeks are the client's calendar weeks between them.
  let cursor = startOfUtcWeek(clientCalendarDay(startDate))
  let weekIndex = 0
  const lastDay = clientCalendarDay(endDate).getTime()

  while (cursor.getTime() <= lastDay) {
    const weekEnd = new Date(cursor)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    weekIndex += 1
    const key = `W${weekIndex}`

    weekBuckets.set(key, { end: weekEnd, start: new Date(cursor), volume: 0 })
    cursor = weekEnd
  }

  logs.forEach((log) => {
    const logDay = clientCalendarDay(log.startedAt).getTime()

    weekBuckets.forEach((bucket) => {
      if (logDay >= bucket.start.getTime() && logDay < bucket.end.getTime()) {
        bucket.volume += log.totalVolume ?? 0
      }
    })
  })

  return Array.from(weekBuckets.entries()).map(([key, bucket]) => ({
    label: `${key}\n${formatMonthDayLabel(bucket.start)}-${formatMonthDayLabel(new Date(bucket.end.getTime() - DAY_IN_MS))}`,
    volume: Math.round(bucket.volume),
  }))
}

/**
 * e1RM strength progression over a date range. Uses estimated 1-rep max
 * (Epley formula) instead of raw weight. Configurable number of top exercises.
 */
function buildStrengthProgressionE1RM(
  logs: ProgressAnalyticsLogRecord[],
  startDate: Date,
  endDate: Date,
  maxExercises = 3,
) {
  // Build daily/weekly e1RM buckets
  const weekBuckets = new Map<string, Date>()
  let cursor = startOfUtcWeek(clientCalendarDay(startDate))
  const lastDay = clientCalendarDay(endDate).getTime()

  while (cursor.getTime() <= lastDay) {
    const weekKey = cursor.toISOString().slice(0, 10)
    weekBuckets.set(weekKey, new Date(cursor))
    const next = new Date(cursor)
    next.setUTCDate(next.getUTCDate() + 7)
    cursor = next
  }

  const weeklyExerciseE1RM = new Map<string, Map<string, number>>()

  logs.forEach((log) => {
    const logWeek = startOfUtcWeek(clientCalendarDay(log.startedAt))
    const weekKey = logWeek.toISOString().slice(0, 10)

    if (!weekBuckets.has(weekKey)) return

    const weekBucket = weeklyExerciseE1RM.get(weekKey) ?? new Map<string, number>()

    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const e1rmResult = getSnapshotMaxE1RM(exercise)

      if (!exerciseName || !e1rmResult) return

      weekBucket.set(exerciseName, Math.max(weekBucket.get(exerciseName) ?? 0, e1rmResult.e1rm))
    })

    weeklyExerciseE1RM.set(weekKey, weekBucket)
  })

  // Rank exercises by frequency then max e1RM
  const exerciseCandidates = new Map<string, { maxE1RM: number; occurrences: number }>()

  weeklyExerciseE1RM.forEach((weekBucket) => {
    weekBucket.forEach((e1rm, exerciseName) => {
      const current = exerciseCandidates.get(exerciseName)

      if (!current) {
        exerciseCandidates.set(exerciseName, { maxE1RM: e1rm, occurrences: 1 })
        return
      }

      exerciseCandidates.set(exerciseName, {
        maxE1RM: Math.max(current.maxE1RM, e1rm),
        occurrences: current.occurrences + 1,
      })
    })
  })

  const series = Array.from(exerciseCandidates.entries())
    .sort((left, right) => {
      const occDelta = right[1].occurrences - left[1].occurrences
      return occDelta !== 0 ? occDelta : right[1].maxE1RM - left[1].maxE1RM
    })
    .slice(0, Math.min(maxExercises, PROGRESS_SERIES_COLORS.length))
    .map(([exerciseName], index) => ({
      color: PROGRESS_SERIES_COLORS[index],
      exerciseName,
      key: `series${index + 1}`,
    }))

  const sortedWeekKeys = Array.from(weekBuckets.keys()).sort()

  const points = sortedWeekKeys.map((weekKey) => {
    const weekBucket = weeklyExerciseE1RM.get(weekKey) ?? new Map<string, number>()
    const weekDate = weekBuckets.get(weekKey)!

    return {
      label: formatMonthDayLabel(weekDate),
      values: Object.fromEntries(
        series.map((item) => [item.key, weekBucket.get(item.exerciseName) ?? null]),
      ),
    }
  })

  return { points, series }
}

/**
 * Detect personal records set within a date range.
 *
 * Compares the best e1RM per exercise before `startDate` (baseline) with the
 * best e1RM within `[startDate, endDate]`. Any improvement is a "new PR".
 */
function detectRecentPRs(
  allLogs: ProgressAnalyticsLogRecord[],
  startDate: Date,
  endDate: Date,
) {
  // Baseline: best e1RM per exercise from all logs before startDate
  const baselineByExercise = new Map<string, number>()
  // Current period: best e1RM per exercise within date range
  const currentByExercise = new Map<string, { date: Date; e1rm: number; reps: number; weight: number }>()

  allLogs.forEach((log) => {
    const isBefore = log.startedAt < startDate
    const isInRange = log.startedAt >= startDate && log.startedAt < endDate

    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const e1rmResult = getSnapshotMaxE1RM(exercise)

      if (!exerciseName || !e1rmResult) return

      if (isBefore) {
        baselineByExercise.set(
          exerciseName,
          Math.max(baselineByExercise.get(exerciseName) ?? 0, e1rmResult.e1rm),
        )
      } else if (isInRange) {
        const current = currentByExercise.get(exerciseName)

        if (!current || e1rmResult.e1rm > current.e1rm) {
          currentByExercise.set(exerciseName, {
            date: log.startedAt,
            e1rm: e1rmResult.e1rm,
            reps: e1rmResult.reps,
            weight: e1rmResult.weight,
          })
        }
      }
    })
  })

  const prs: Array<{
    date: Date
    delta: number
    exerciseName: string
    type: "e1rm" | "weight"
    unit: string
    value: number
  }> = []

  currentByExercise.forEach((current, exerciseName) => {
    const baseline = baselineByExercise.get(exerciseName) ?? 0
    const delta = Math.round((current.e1rm - baseline) * 10) / 10

    // Only count as a PR if there is measurable improvement
    if (delta > 0) {
      prs.push({
        date: current.date,
        delta,
        exerciseName,
        type: "e1rm",
        unit: "kg",
        value: current.weight,
      })
    }
  })

  return prs.sort((a, b) => b.date.getTime() - a.date.getTime())
}

/**
 * Build the full dashboard summary object from current and previous period logs.
 */
function buildDashboardSummary(
  currentLogs: DashboardLogRecord[],
  prevLogs: DashboardLogRecord[],
  allLogs: ProgressAnalyticsLogRecord[],
  workoutsPerWeek: number,
  startDate: Date,
  endDate: Date,
) {
  const weekCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (7 * DAY_IN_MS)))

  // Completed workouts
  const completedWorkouts = currentLogs.length
  const plannedWorkouts = workoutsPerWeek > 0 ? Math.round(workoutsPerWeek * weekCount) : 0
  const completionRate = plannedWorkouts > 0 ? Math.round((completedWorkouts / plannedWorkouts) * 100) : 0
  const completedDelta = completedWorkouts - prevLogs.length

  // Total volume
  const totalVolume = Math.round(currentLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0))
  const prevTotalVolume = prevLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const volumeDeltaPct = prevTotalVolume > 0 ? Math.round(((totalVolume - prevTotalVolume) / prevTotalVolume) * 100) : 0

  // e1RM change — compare sum of best e1RM per exercise between periods
  const currentE1RMs = new Map<string, number>()
  const prevE1RMs = new Map<string, number>()

  currentLogs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const name = getSnapshotExerciseName(exercise)
      const result = getSnapshotMaxE1RM(exercise)
      if (!name || !result) return
      currentE1RMs.set(name, Math.max(currentE1RMs.get(name) ?? 0, result.e1rm))
    })
  })

  prevLogs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const name = getSnapshotExerciseName(exercise)
      const result = getSnapshotMaxE1RM(exercise)
      if (!name || !result) return
      prevE1RMs.set(name, Math.max(prevE1RMs.get(name) ?? 0, result.e1rm))
    })
  })

  let e1rmChangeTotal = 0
  let prevE1rmTotal = 0

  currentE1RMs.forEach((currentE1rm, exerciseName) => {
    const prevE1rm = prevE1RMs.get(exerciseName)
    if (prevE1rm != null) {
      e1rmChangeTotal += currentE1rm - prevE1rm
      prevE1rmTotal += prevE1rm
    }
  })

  const e1rmChangeTotalKg = Math.round(e1rmChangeTotal * 10) / 10
  const e1rmChangePct = prevE1rmTotal > 0 ? Math.round((e1rmChangeTotal / prevE1rmTotal) * 1000) / 10 : 0

  // New PRs
  const recentPRs = detectRecentPRs(allLogs, startDate, endDate)
  const newPRsCount = recentPRs.length
  const latestPR = recentPRs.length > 0
    ? { deltaKg: recentPRs[0].delta, exerciseName: recentPRs[0].exerciseName }
    : null

  // Sub-stats
  const sessionsPerWeek = Math.round((completedWorkouts / weekCount) * 10) / 10

  const uniqueDays = new Set(currentLogs.map((log) => clientCalendarDay(log.startedAt).getTime()))
  const trainingDays = uniqueDays.size

  const durations = currentLogs
    .filter((log) => log.completedAt != null)
    .map((log) => (log.completedAt!.getTime() - log.startedAt.getTime()) / 60_000)
    .filter((mins) => mins > 0 && mins < 600) // sanity: exclude 10h+ sessions

  const avgDurationMins = durations.length > 0
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : 0

  return {
    avgDurationMins,
    completedDelta,
    completedWorkouts,
    completionRate,
    e1rmChangePct,
    e1rmChangeTotalKg,
    latestPR,
    newPRsCount,
    planAdherencePct: completionRate,
    plannedWorkouts,
    sessionsPerWeek,
    totalVolume,
    trainingDays,
    volumeDeltaPct,
  }
}


export {
  buildDashboardSummary,
  buildMuscleGroupDistribution,
  buildPersonalRecords,
  buildStrengthProgression,
  buildStrengthProgressionE1RM,
  buildTrainingVolumeByWeek,
  buildWeeklyVolume,
  buildWorkoutFrequency,
  calculateWorkoutStreaks,
  calculateWorkoutVolume,
  detectRecentPRs,
  PROGRESS_PIE_COLORS,
  PROGRESS_SERIES_COLORS,
}
export type { DashboardLogRecord, ProgressAnalyticsLogRecord }

