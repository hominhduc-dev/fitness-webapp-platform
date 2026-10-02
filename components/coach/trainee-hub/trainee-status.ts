import type { CoachTrainee } from "@/lib/fitness/types"
import type { AppMessages } from "@/lib/i18n/messages"

/** Where a trainee stands this week, from their planned and finished sessions. */
export type TraineeStatus = "on-track" | "behind" | "rest"

export const TRAINEE_STATUSES: readonly TraineeStatus[] = ["on-track", "behind", "rest"]

export function deriveTraineeStatus(trainee: Pick<CoachTrainee, "plannedSessionsPerWeek" | "thisWeekWorkouts">): TraineeStatus {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  if (planned <= 0) return "rest"
  return trainee.thisWeekWorkouts / planned >= 0.8 ? "on-track" : "behind"
}

/** Share of this week's planned sessions done, 0–100, or null with nothing planned. */
export function weekPercent(trainee: Pick<CoachTrainee, "plannedSessionsPerWeek" | "thisWeekWorkouts">) {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  return planned > 0 ? Math.min(100, Math.round((trainee.thisWeekWorkouts / planned) * 100)) : null
}

export const TRAINEE_STATUS_DOT: Record<TraineeStatus, string> = {
  "on-track": "bg-success",
  behind: "bg-warning",
  rest: "bg-muted-foreground/40",
}

export function traineeStatusLabel(status: TraineeStatus, messages: AppMessages) {
  if (status === "on-track") return messages.coach.statusOnTrack
  if (status === "behind") return messages.coach.statusBehind
  return messages.coach.statusRestWeek
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase()
}
