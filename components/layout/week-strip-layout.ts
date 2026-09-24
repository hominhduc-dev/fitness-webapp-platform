/**
 * Shared geometry of the phone week strips (Home's greeting and Nutrition), so
 * switching between the two pages leaves the strip exactly where it was. Only
 * the frame lives here; each page fills the day cell with its own content and
 * picks its state styling (`day-card-glow`, or the filled accent for today).
 */
export const WEEK_STRIP_GRID_CLASS = "grid grid-cols-7 gap-1.5"

export const WEEK_STRIP_DAY_CLASS =
  "relative flex min-h-[4.8rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border px-1 text-center"
