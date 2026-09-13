"use client"

import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

type PR = {
  date: string
  delta: number
  exerciseName: string
  type: "weight" | "e1rm"
  unit: string
  value: number
}

export function PrFeed({ prs }: { prs: PR[] }) {
  if (prs.length === 0) {
    return <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg border-dashed">No recent PRs.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {prs.map((pr, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{pr.exerciseName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div className="text-right">
            <div className={cn("text-sm font-semibold tnum", pr.delta > 0 ? "text-[var(--success)]" : "text-foreground")}>
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
