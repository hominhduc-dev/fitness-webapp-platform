import type { Workout } from "@/lib/types"

/** An explicit calendar date takes precedence over a recurring weekday. */
export function matchesWorkoutSchedule(workout: Pick<Workout, "scheduledDate" | "scheduledDay">, date: Date) {
  if (workout.scheduledDate) {
    return workout.scheduledDate.getFullYear() === date.getFullYear()
      && workout.scheduledDate.getMonth() === date.getMonth()
      && workout.scheduledDate.getDate() === date.getDate()
  }
  return typeof workout.scheduledDay === "number" && workout.scheduledDay === date.getDay()
}
