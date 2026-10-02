"use client"

import { Minus, TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

import { Sparkline } from "./sparkline"
import { useCountUp } from "./use-count-up"

/**
 * A stat tile: the number, a change chip that says which way and by how much,
 * and a sparkline of the period. The chip carries an arrow and a sign, so the
 * direction never rests on its colour.
 */
export function KpiTile({
  changeLabel,
  changePct,
  detail,
  format,
  label,
  series,
  unit,
  value,
}: {
  changeLabel?: string
  changePct?: number | null
  detail?: string
  format: (value: number) => string
  label: string
  series?: readonly number[]
  unit?: string
  value: number | null
}) {
  const animated = useCountUp(value)
  const direction = changePct == null || changePct === 0 ? "flat" : changePct > 0 ? "up" : "down"
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-3 sm:p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-foreground">
        {value == null ? "—" : format(animated)}
        {unit && value != null ? <span className="text-xs font-normal tracking-normal text-muted-foreground">{unit}</span> : null}
      </p>
      <div className="mt-2 flex min-h-7 items-end justify-between gap-2">
        {changePct != null ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tnum",
              direction === "up" && "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success-text",
              direction === "down" && "bg-destructive/10 text-destructive-text",
              direction === "flat" && "bg-muted text-muted-foreground",
            )}
            title={changeLabel}
          >
            <Icon className="size-3" strokeWidth={2.5} aria-hidden="true" />
            {changePct > 0 ? "+" : ""}{changePct}%
          </span>
        ) : detail ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground" title={detail}>{detail}</span>
        ) : <span />}
        {series ? <Sparkline values={series} className="h-7 w-14 shrink-0 text-primary sm:w-20" /> : null}
      </div>
    </div>
  )
}
