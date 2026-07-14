import type { SerializedProfile } from "../../auth.service"
import {
  addDays,
  completedSetCount,
  createSection,
  formatDate,
  formatNumber,
  isSameLocalDate,
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
  const startOfWeek = startOfLocalDay(addDays(today, -today.getDay()))
  const thirtyDaysAgo = addDays(now, -30)

  const [assignments, recentLogs, weekLogs] = await Promise.all([
    db.programAssignment.findMany({
      include: {
        program: {
          include: {
            workouts: {
              include: {
                exercises: {
                  include: {
                    sets: { orderBy: { setNumber: "asc" } },
                    variation: { include: { exercise: true } },
                  },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      take: 2,
      where: { program: { archivedAt: null }, userId: profile.id },
    }),
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
      where: { startedAt: { gte: thirtyDaysAgo }, userId: profile.id },
    }),
    db.workoutLog.findMany({
      select: { completedAt: true, totalVolume: true },
      where: { startedAt: { gte: startOfWeek }, userId: profile.id },
    }),
  ])

  const allWorkouts = assignments.flatMap((assignment) => assignment.program.workouts)
  const todayWorkout =
    allWorkouts.find((workout) => workout.scheduledDate && isSameLocalDate(workout.scheduledDate, today)) ??
    allWorkouts.find((workout) => workout.scheduledDay === today.getDay()) ??
    null
  const nextWorkout = todayWorkout ? null : findNextWorkout(allWorkouts, today)
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

function findNextWorkout<T extends { scheduledDate: Date | null; scheduledDay: number | null }>(workouts: T[], today: Date) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const targetDate = addDays(today, offset)
    const workout =
      workouts.find((item) => item.scheduledDate && isSameLocalDate(item.scheduledDate, targetDate)) ??
      workouts.find((item) => item.scheduledDay === targetDate.getDay())

    if (workout) {
      return {
        label: `${weekdayLabel(targetDate.getDay())} ${formatDate(targetDate)}`,
        workout,
      }
    }
  }

  return null
}

function describePlannedWorkout(workout: {
  duration: number | null
  exercises: Array<{
    sets: Array<{ targetReps: number; targetRepsMin: number | null }>
    variation: { exercise: { name: string } }
  }>
  name: string
  scheduledDay: number | null
}) {
  const exerciseSummary = workout.exercises
    .slice(0, 5)
    .map((exercise) => {
      const firstSet = exercise.sets[0]
      const reps = firstSet ? (firstSet.targetRepsMin ? `${firstSet.targetRepsMin}-${firstSet.targetReps}` : String(firstSet.targetReps)) : "?"
      return `${exercise.variation.exercise.name} ${exercise.sets.length}x${reps}`
    })
    .join("; ")

  return `${workout.name} (${weekdayLabel(workout.scheduledDay)}${workout.duration ? `, ${workout.duration} phút` : ""})${exerciseSummary ? ` — ${exerciseSummary}` : ""}.`
}
