"use client"

import { Dumbbell, TrendingUp } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

type PR = { date: string; delta: number; exerciseName: string; type: "weight" | "e1rm"; unit: string; value: number }

/** Recent PRs as a timeline, each badged by kind so an e1RM PR and a heavier single read differently. */
export function PrTimeline({ prs }: { prs: PR[] }) {
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview.prs
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" })

  if (prs.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{messages.progressPage.analytics.noRecords}</p>
  }

  return (
    <ol className="relative space-y-3 pl-5 before:absolute before:inset-y-1 before:left-[7px] before:w-px before:bg-border">
      {prs.map((pr) => {
        const Icon = pr.type === "weight" ? Dumbbell : TrendingUp
        return (
          <li key={`${pr.exerciseName}-${pr.date}-${pr.type}`} className="relative">
            <span
              className={cn(
                "absolute -left-5 top-0.5 flex size-[15px] items-center justify-center rounded-full ring-2 ring-card",
                pr.type === "weight" ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground",
              )}
              aria-hidden="true"
            >
              <Icon className="size-2.5" strokeWidth={3} />
            </span>
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{pr.exerciseName}</p>
              <p className="shrink-0 text-sm font-semibold tnum text-success-text">+{pr.delta} {pr.unit}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pr.type === "weight" ? copy.weight : copy.e1rm} · {pr.value} {pr.unit} · {date.format(new Date(pr.date))}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
