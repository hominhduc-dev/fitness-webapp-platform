import { listWorkoutsForTrainee } from "../../fitness-data/workout"
import type { SerializedProfile } from "../../auth.service"
import { startOfClientDay } from "../../../lib/ai/calendar"
import {
  addDays,
  completedSetCount,
  createSection,
  formatDate,
  formatNumber,
  parseExerciseSnapshot,
  snapshotExerciseLabel,
  snapshotWorkoutName,
  startOfLocalDay,
  totalSetCount,
  weekdayLabel,
  type ContextPrismaClient,
} from "./helpers"
import type { ContextSection } from "./types"

export async function buildWorkoutContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
  now: Date,
): Promise<ContextSection | null> {
  const today = startOfLocalDay(now)
  const startOfWeek = addDays(startOfClientDay(now), -((today.getUTCDay() + 6) % 7))
  const thirtyDaysAgo = addDays(now, -30)

  const [collection, recentLogs, weekLogs] = await Promise.all([
    listWorkoutsForTrainee(profile),
    db.workoutLog.findMany({
      orderBy: { startedAt: "desc" },
      select: {
        completedAt: true,
        exerciseSnapshot: true,
        notes: true,
        startedAt: true,
        totalVolume: true,
        workout: { select: { name: true } },
        workoutSnapshot: true,
      },
      take: 8,
      where: { startedAt: { gte: thirtyDaysAgo, lte: now }, userId: profile.id },
    }),
    db.workoutLog.findMany({
      select: { completedAt: true, totalVolume: true },
      where: { startedAt: { gte: startOfWeek, lte: now }, completedAt: { not: null, lte: now }, userId: profile.id },
    }),
  ])

  const todayEntry = collection.scheduleEntries.find((entry) => entry.isToday)
  const todayWorkout = todayEntry && !todayEntry.isCompleted ? todayEntry.workout : null
  const nextEntry = collection.scheduleEntries.find((entry) => entry.date > formatDate(today) && entry.workout && !entry.isCompleted)
  const nextWorkout = nextEntry?.workout ? { label: nextEntry.date, workout: nextEntry.workout } : null
  const completedWeekLogs = weekLogs.filter((log) => log.completedAt != null)
  const lines: string[] = []

  if (todayWorkout) {
    lines.push(`- Hôm nay nên tập: ${describePlannedWorkout(todayWorkout)}`)
  } else if (nextWorkout) {
    lines.push(`- Hôm nay không có buổi cố định. Buổi kế tiếp: ${nextWorkout.label} — ${describePlannedWorkout(nextWorkout.workout)}`)
  } else {
    lines.push("- Chưa tìm thấy workout hôm nay hoặc buổi kế tiếp trong active program.")
  }

  if (completedWeekLogs.length > 0) {
    const totalVolume = completedWeekLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
    lines.push(`- Tuần này đã hoàn thành ${completedWeekLogs.length} buổi, tổng volume ${formatNumber(totalVolume)}kg.`)
  } else {
    lines.push("- Tuần này chưa có workout log hoàn thành.")
  }

  if (recentLogs.length > 0) {
    lines.push("- Workout logs gần đây:")
    for (const log of recentLogs.slice(0, 5)) {
      const exercises = parseExerciseSnapshot(log.exerciseSnapshot)
      const topExercises = exercises.slice(0, 3).map(snapshotExerciseLabel).join(", ")
      const completedSets = completedSetCount(exercises)
      const totalSets = totalSetCount(exercises)
      lines.push(
        `  • ${formatDate(log.startedAt)} ${snapshotWorkoutName(log.workoutSnapshot, log.workout?.name)}: ` +
          `${log.completedAt ? "hoàn thành" : "chưa hoàn thành"}, ${formatNumber(log.totalVolume ?? 0)}kg volume` +
          `${totalSets ? `, ${completedSets}/${totalSets} set` : ""}${topExercises ? `, bài chính: ${topExercises}` : ""}.`,
      )
    }
  } else {
    lines.push("- 30 ngày gần đây chưa có workout log.")
  }

  return createSection("recent_workouts", "WORKOUT CONTEXT", 85, lines)
}

function describePlannedWorkout(workout: {
  duration?: number | null
  exercises: Array<{
    sets: Array<{ targetReps: number; targetRepsMin?: number | null }>
    exercise: { name: string }
  }>
  name: string
  scheduledDay?: number | null
}) {
  const exerciseSummary = workout.exercises
    .slice(0, 5)
    .map((exercise) => {
      const firstSet = exercise.sets[0]
      const reps = firstSet ? (firstSet.targetRepsMin ? `${firstSet.targetRepsMin}-${firstSet.targetReps}` : String(firstSet.targetReps)) : "?"
      return `${exercise.exercise.name} ${exercise.sets.length}x${reps}`
    })
    .join("; ")

  return `${workout.name} (${weekdayLabel(workout.scheduledDay)}${workout.duration ? `, ${workout.duration} phút` : ""})${exerciseSummary ? ` — ${exerciseSummary}` : ""}.`
}
