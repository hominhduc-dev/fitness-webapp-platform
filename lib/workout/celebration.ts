/**
 * A one-shot "the workout just landed" flag, handed from the session screen to
 * the dashboard.
 *
 * The session screen cannot celebrate on its own: `performSave` pushes to
 * /dashboard the moment the log is accepted, so anything drawn there is torn
 * down a few frames later. The flag survives that navigation and the dashboard
 * spends it on arrival.
 *
 * sessionStorage rather than a `?celebrate=1` query param, because the param
 * would sit in the URL and fire again on refresh or on a back-navigation into
 * the dashboard. Reading here consumes the flag, so one finish is one
 * celebration.
 */

const CELEBRATION_KEY = "yeahbuddy-workout-celebration"

export type WorkoutCelebration = {
  /** Shown in the toast so the trainee sees which session was recorded. */
  workoutName: string
  /** False when the log is sitting in the offline queue rather than saved. */
  savedOnline: boolean
}

/**
 * Every storage call is wrapped: Safari's private mode throws on write, and a
 * missed celebration must never take the finish flow down with it.
 */
export function markWorkoutCelebration(celebration: WorkoutCelebration) {
  try {
    window.sessionStorage.setItem(CELEBRATION_KEY, JSON.stringify(celebration))
  } catch {
    // Non-essential: the log is already saved either way.
  }
}

/** Reads and clears in one go — a second caller gets nothing. */
export function consumeWorkoutCelebration(): WorkoutCelebration | null {
  let raw: string | null = null

  try {
    raw = window.sessionStorage.getItem(CELEBRATION_KEY)
    window.sessionStorage.removeItem(CELEBRATION_KEY)
  } catch {
    return null
  }

  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const { savedOnline, workoutName } = parsed as Partial<WorkoutCelebration>
    // A half-written or hand-edited entry should be ignored, not rendered.
    if (typeof workoutName !== "string") return null

    return { savedOnline: savedOnline === true, workoutName }
  } catch {
    return null
  }
}

/**
 * Whether to draw particles at all.
 *
 * globals.css already collapses every CSS animation under
 * `prefers-reduced-motion`, but confetti paints to a canvas on
 * requestAnimationFrame, which no stylesheet can reach — so the check has to
 * happen here. The toast still shows; only the motion is dropped.
 */
export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}
