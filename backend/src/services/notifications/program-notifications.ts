import { NotificationType } from "@prisma/client"

import type { NotificationDraft } from "./notification-dispatch.service"

/**
 * Copy for event notifications a coach's program changes produce. Pure, so the
 * wording rules (which name to show) are testable without a database.
 */

const PROGRAM_URL = "/workout"

function buildProgramAssignedDraft(input: {
  coachId: string
  programId: string
  programName: string
  traineeId: string
}): NotificationDraft {
  return {
    message: `Your coach assigned ${input.programName}.`,
    metadata: {
      kind: "program_assigned",
      programName: input.programName,
      traineeId: input.traineeId,
      trainerId: input.coachId,
    },
    relatedEntityId: input.programId,
    relatedEntityType: "program",
    title: "New program assigned",
    type: NotificationType.program_assigned,
    url: PROGRAM_URL,
    userId: input.traineeId,
  }
}

/**
 * Names the one workout that changed ("Chest Day has been adjusted…"). A program
 * repeats a workout name across weeks, so names are compared after de-duplication;
 * several different workouts, or only program-level details, fall back to the
 * program name.
 */
function describeAdjustedTarget(programName: string, changedWorkoutNames: readonly string[]) {
  const names = Array.from(new Set(changedWorkoutNames.map((name) => name.trim()).filter(Boolean)))
  return names.length === 1 ? names[0] : programName
}

function buildProgramUpdatedDraft(input: {
  changedWorkoutNames: readonly string[]
  coachId: string
  /** Kept on the row: the trainee schedule reads it to highlight what changed. */
  metadata: Record<string, unknown>
  programId: string
  programName: string
  traineeId: string
}): NotificationDraft {
  const adjustedTarget = describeAdjustedTarget(input.programName, input.changedWorkoutNames)

  return {
    message: `${adjustedTarget} has been adjusted by your coach.`,
    metadata: {
      ...input.metadata,
      adjustedTarget,
      kind: "program_updated",
      programName: input.programName,
      traineeId: input.traineeId,
      trainerId: input.coachId,
    },
    relatedEntityId: input.programId,
    relatedEntityType: "program",
    title: "Coach updated your program",
    type: NotificationType.program_updated,
    url: PROGRAM_URL,
    userId: input.traineeId,
  }
}

export { buildProgramAssignedDraft, buildProgramUpdatedDraft, describeAdjustedTarget }
