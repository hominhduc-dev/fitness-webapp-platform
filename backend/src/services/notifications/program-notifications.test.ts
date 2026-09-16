import { NotificationType } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { buildNotificationData, isPushAllowed } from "./notification-dispatch.service"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-preferences.service"
import { buildProgramAssignedDraft, buildProgramUpdatedDraft, describeAdjustedTarget } from "./program-notifications"

describe("describeAdjustedTarget", () => {
  it("names the single workout that changed, even when it repeats across weeks", () => {
    expect(describeAdjustedTarget("Hypertrophy Phase 1", ["Chest Day"])).toBe("Chest Day")
    expect(describeAdjustedTarget("Hypertrophy Phase 1", ["Chest Day", " Chest Day "])).toBe("Chest Day")
  })

  it("falls back to the program name for several workouts or none", () => {
    expect(describeAdjustedTarget("Hypertrophy Phase 1", ["Chest Day", "Leg Day"])).toBe("Hypertrophy Phase 1")
    expect(describeAdjustedTarget("Hypertrophy Phase 1", [])).toBe("Hypertrophy Phase 1")
  })
})

describe("program notification drafts", () => {
  it("builds the assignment copy", () => {
    const draft = buildProgramAssignedDraft({
      coachId: "coach-1",
      programId: "program-1",
      programName: "Hypertrophy Phase 1",
      traineeId: "trainee-1",
    })

    expect(draft).toMatchObject({
      message: "Your coach assigned Hypertrophy Phase 1.",
      relatedEntityId: "program-1",
      title: "New program assigned",
      type: NotificationType.program_assigned,
      userId: "trainee-1",
    })
  })

  it("builds the update copy and keeps the schedule-highlight metadata", () => {
    const draft = buildProgramUpdatedDraft({
      changedWorkoutNames: ["Chest Day"],
      coachId: "coach-1",
      metadata: { updatedWorkoutIds: ["workout-1"] },
      programId: "program-1",
      programName: "Hypertrophy Phase 1",
      traineeId: "trainee-1",
    })
    const row = buildNotificationData(draft, new Date("2026-09-21T00:00:00Z"))

    expect(row).toMatchObject({
      message: "Chest Day has been adjusted by your coach.",
      title: "Coach updated your program",
      type: NotificationType.program_updated,
    })
    expect(row.metadata).toMatchObject({ kind: "program_updated", updatedWorkoutIds: ["workout-1"], url: "/workout" })
  })
})

describe("isPushAllowed", () => {
  it("gates coach program pushes on the user's setting", () => {
    expect(isPushAllowed(NotificationType.program_updated, DEFAULT_NOTIFICATION_PREFERENCES)).toBe(true)
    expect(isPushAllowed(NotificationType.program_assigned, { ...DEFAULT_NOTIFICATION_PREFERENCES, coachProgramUpdates: false })).toBe(false)
  })

  it("keeps scheduled reminders off until the user opts in", () => {
    expect(isPushAllowed(NotificationType.weight_reminder, DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false)
    expect(isPushAllowed(NotificationType.check_in_reminder, DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false)
    expect(isPushAllowed(NotificationType.workout_session_open, DEFAULT_NOTIFICATION_PREFERENCES)).toBe(true)
  })
})
