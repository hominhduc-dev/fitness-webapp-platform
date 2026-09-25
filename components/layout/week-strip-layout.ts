/**
 * Shared geometry of the phone week strips (Home's greeting and Nutrition), so
 * switching between the two pages leaves the strip exactly where it was. The
 * day cell's anatomy and states live in `week-day-cell.tsx`; each page only
 * supplies its own status indicator.
 */
export const WEEK_STRIP_GRID_CLASS = "grid grid-cols-7 gap-1.5"

// 64px tall: weekday, date and a 16px indicator row, still above the 44px
// touch target.
export const WEEK_STRIP_DAY_CLASS =
  "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-[1.15rem] border px-1 text-center"
