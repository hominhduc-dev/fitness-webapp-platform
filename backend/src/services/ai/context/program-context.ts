import type { SerializedProfile } from "../../auth.service"
import { createSection, formatDate, formatNumber, weekdayLabel, type ContextPrismaClient } from "./helpers"
import type { ContextSection } from "./types"

export async function buildProgramContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
): Promise<ContextSection | null> {
  const assignments = await db.programAssignment.findMany({
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
            orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }, { name: "asc" }],
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
    take: 2,
    where: {
      program: { archivedAt: null },
      userId: profile.id,
    },
  })

  if (assignments.length === 0) {
    return createSection("program", "ACTIVE PROGRAM", 70, ["- Chưa có active program được assign."])
  }

  const lines: string[] = []

  for (const assignment of assignments) {
    const program = assignment.program
    lines.push(
      `- ${program.name}: ${program.workoutsPerWeek} buổi/tuần, ${program.duration} tuần, độ khó ${program.difficulty}, assigned ${formatDate(assignment.assignedAt)}.`,
    )

    for (const workout of program.workouts.slice(0, 6)) {
      const exercises = workout.exercises
        .slice(0, 5)
        .map((exercise) => {
          const firstSet = exercise.sets[0]
          const repTarget = firstSet
            ? firstSet.targetRepsMin
              ? `${firstSet.targetRepsMin}-${firstSet.targetReps}`
              : String(firstSet.targetReps)
            : "?"
          return `${exercise.variation.exercise.name} ${exercise.sets.length}x${repTarget}`
        })
        .join("; ")

      lines.push(
        `  • ${weekdayLabel(workout.scheduledDay)}${workout.weekIndex != null ? ` W${workout.weekIndex + 1}` : ""}: ` +
          `${workout.name}${workout.duration ? ` (${formatNumber(workout.duration)} phút)` : ""}${exercises ? ` — ${exercises}` : ""}`,
      )
    }
  }

  return createSection("program", "ACTIVE PROGRAM", 70, lines)
}
