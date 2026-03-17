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
    <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)]">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{messages.dashboard.recentActivity}</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{messages.dashboard.recentActivity}</h3>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-slate-500">{messages.dashboard.noRecentWorkouts}</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.16)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-slate-950">{log.workout.name}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDistanceToNow(log.completedAt || log.startedAt, {
                      addSuffix: true,
                      locale: locale === "vi" ? vi : enUS,
                    })}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
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
