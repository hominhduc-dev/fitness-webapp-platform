"use client"

import { Flame } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { ConsistencyCell } from "@/lib/fitness/progress-overview"
import { cn } from "@/lib/utils"

/** One hue, light → dark, for volume on a training day (sequential, never a rainbow). */
const LEVEL_FILL = [
  "bg-muted",
  "bg-[color-mix(in_srgb,var(--primary)_25%,var(--card))]",
  "bg-[color-mix(in_srgb,var(--primary)_45%,var(--card))]",
  "bg-[color-mix(in_srgb,var(--primary)_70%,var(--card))]",
  "bg-primary",
] as const

/**
 * Twelve weeks of training days, GitHub-style: a column per week, Monday at the
 * top, darker for more volume. Each cell names its day, sessions and volume for
 * screen readers and on hover, so the shade is never the only way to read it.
 */
export function ConsistencyCard({
  activeDays,
  columns,
  weekStreak,
}: {
  activeDays: number
  columns: ConsistencyCell[][]
  weekStreak: number
}) {
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview.consistency
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", weekday: "short" })
  const number = new Intl.NumberFormat(locale)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">{copy.activeDays(activeDays)}</span>
        {weekStreak > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
            <Flame className="size-3.5" aria-hidden="true" />
            {copy.weekStreak(weekStreak)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={copy.title}>
        {columns.flat().map((cell) => {
          const label = copy.day(dateFormat.format(new Date(`${cell.date}T12:00:00`)), cell.count, number.format(Math.round(cell.volume)))
          return (
            <span
              key={cell.date}
              title={cell.isFuture ? undefined : label}
              aria-label={cell.isFuture ? undefined : label}
              className={cn(
                "aspect-square w-full rounded-[3px]",
                cell.isFuture ? "bg-transparent" : LEVEL_FILL[cell.level],
              )}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground" aria-hidden="true">
        {copy.less}
        {LEVEL_FILL.map((fill) => <span key={fill} className={cn("size-2.5 rounded-[2px]", fill)} />)}
        {copy.more}
      </div>
    </div>
  )
}
