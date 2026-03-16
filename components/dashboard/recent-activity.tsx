"use client"

import { CheckCircle2, Clock, Dumbbell } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import type { WorkoutLog } from "@/lib/types"
import { useLocale } from "@/components/providers/locale-provider"

interface RecentActivityProps {
  logs: WorkoutLog[]
}

export function RecentActivity({ logs }: RecentActivityProps) {
  const { locale, messages } = useLocale()

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">{messages.dashboard.recentActivity}</h3>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{messages.dashboard.noRecentWorkouts}</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 rounded-lg bg-muted/30 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{log.workout.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(log.completedAt || log.startedAt, {
                      addSuffix: true,
                      locale: locale === "vi" ? vi : enUS,
                    })}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(((log.completedAt?.getTime() || 0) - log.startedAt.getTime()) / 60000)} {messages.dashboard.min}
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {log.exercises.length} {messages.dashboard.exercises}
                  </span>
                  {log.totalVolume && <span>{log.totalVolume.toLocaleString()} {messages.dashboard.lbs}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
