import { UserRole } from "@prisma/client"

import type { SerializedProfile } from "../../auth.service"
import {
  addDays,
  createSection,
  formatDate,
  snapshotWorkoutName,
  summarizeText,
  type ContextPrismaClient,
} from "./helpers"
import type { ContextSection } from "./types"

export async function buildCoachNoteContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
  now: Date,
): Promise<ContextSection | null> {
  const ninetyDaysAgo = addDays(now, -90)

  const [checkIns, comments] = await Promise.all([
    db.coachCheckIn.findMany({
      include: { coach: { select: { name: true } } },
      orderBy: { checkInDate: "desc" },
      take: 3,
      where: {
        checkInDate: { gte: ninetyDaysAgo },
        traineeId: profile.id,
      },
    }),
    db.workoutLogComment.findMany({
      include: {
        author: { select: { name: true } },
        workoutLog: {
          select: {
            startedAt: true,
            workout: { select: { name: true } },
            workoutSnapshot: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      where: {
        author: { role: UserRole.coach },
        createdAt: { gte: ninetyDaysAgo },
        workoutLog: { userId: profile.id },
      },
    }),
  ])

  const lines: string[] = []

  if (checkIns.length > 0) {
    lines.push("- Coach check-ins gần đây:")
    for (const checkIn of checkIns) {
      const scores = [
        checkIn.adherenceScore != null ? `adherence ${checkIn.adherenceScore}/10` : "",
        checkIn.energyScore != null ? `energy ${checkIn.energyScore}/10` : "",
        checkIn.recoveryScore != null ? `recovery ${checkIn.recoveryScore}/10` : "",
        checkIn.moodScore != null ? `mood ${checkIn.moodScore}/10` : "",
      ].filter(Boolean)
      lines.push(
        `  • ${formatDate(checkIn.checkInDate)} ${checkIn.coach.name}: ${scores.length ? `${scores.join(", ")}. ` : ""}` +
          `${summarizeText(checkIn.feedback, 180)}${checkIn.nextFocus ? ` Next focus: ${summarizeText(checkIn.nextFocus, 100)}` : ""}`,
      )
    }
  }

  if (comments.length > 0) {
    lines.push("- Coach comments trên workout logs:")
    for (const comment of comments) {
      lines.push(
        `  • ${formatDate(comment.createdAt)} ${comment.author.name} về ` +
          `${snapshotWorkoutName(comment.workoutLog.workoutSnapshot, comment.workoutLog.workout?.name)}: ` +
          `${summarizeText(comment.content, 180)}`,
      )
    }
  }

  if (lines.length === 0) {
    lines.push("- Chưa có check-in hoặc comment từ coach trong 90 ngày gần đây.")
  }

  return createSection("coach_notes", "COACH NOTES", 74, lines)
}
