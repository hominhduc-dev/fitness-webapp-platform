import type { ReactNode } from "react"

import { WEEK_STRIP_DAY_CLASS } from "@/components/layout/week-strip-layout"
import { cn } from "@/lib/utils"

/**
 * One day of the phone week strips (Home and Nutrition). Both pages share the
 * anatomy — weekday, date, then one status indicator — so switching between
 * them only changes the bottom row. The frame stays quiet (hairline border);
 * the state carries the emphasis:
 * - today is filled with the accent,
 * - the selected day (Nutrition, when it is not today) gets an accent ring,
 * - days still ahead are dimmed, so the week reads as done / now / to come.
 */
export function weekDayCellClass({ future, isToday, selected = false }: { future: boolean; isToday: boolean; selected?: boolean }) {
  return cn(
    WEEK_STRIP_DAY_CLASS,
    // Outlines, not rings: `.bg-card` sets its own box-shadow outside any layer,
    // which beats a ring utility and would erase both focus and selection.
    "outline-none transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    isToday
      ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_var(--primary)]"
      : cn(
          "border-border bg-card hover:bg-surface-hover",
          // Drawn inside the cell, so the selected day does not shift its
          // content by a pixel.
          selected && "border-transparent outline-solid outline-2 -outline-offset-2 outline-primary",
          future ? "text-muted-foreground" : "text-foreground",
        ),
  )
}

export function WeekDayCellContent({
  date,
  indicator,
  isToday,
  weekday,
}: {
  date: number | null
  indicator?: ReactNode
  isToday: boolean
  weekday: string | null
}) {
  return (
    <>
      <span className={cn("text-xs font-medium leading-none", isToday ? "text-primary-foreground/85" : "text-muted-foreground")}>
        {weekday ?? " "}
      </span>
      <span className="font-mono text-base font-semibold leading-none tnum">{date ?? " "}</span>
      {/* A fixed-height slot, so days with and without an indicator line up. */}
      <span aria-hidden="true" className="flex h-4 items-center justify-center">
        {indicator}
      </span>
    </>
  )
}
