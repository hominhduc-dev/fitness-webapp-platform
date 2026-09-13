"use client"

import { useLocale } from "@/components/providers/locale-provider"

type PR = {
  date: string
  delta: number
  exerciseName: string
  type: "weight" | "e1rm"
  unit: string
  value: number
}

export function PrFeed({ prs }: { prs: PR[] }) {
  const { locale, messages } = useLocale()
  if (prs.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{messages.progressPage.analytics.noRecords}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {prs.map((pr, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{pr.exerciseName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(pr.date).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium tabular-nums text-foreground">
              {pr.delta > 0 ? "+" : ""}{pr.delta} {pr.type === "weight" ? pr.unit : pr.type === "e1rm" ? "kg (e1rm)" : pr.unit}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {pr.value} {pr.unit}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
