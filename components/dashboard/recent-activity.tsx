"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { CheckCircle2, Clock, Dumbbell } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import type { WorkoutLog } from "@/lib/types"

interface RecentActivityProps {
  emptyMessage?: string
  logs: WorkoutLog[]
  title?: string
}

export function RecentActivity({ emptyMessage, logs, title }: RecentActivityProps) {
  const { locale, messages } = useLocale()
  const { profile } = useAuth()
  const weightUnitLabel = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  return (
    <section className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
      <h3 className="text-2xl font-black tracking-tight text-foreground">
        {title ?? messages.dashboard.recentActivity}
      </h3>

      <div className="mt-6 space-y-4">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {emptyMessage ?? messages.dashboard.noRecentWorkouts}
          </p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-[24px] bg-muted p-4 sm:p-5">
              <div className="flex items-start gap-4 sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-bold tracking-tight text-foreground">{log.workout.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {Math.max(1, Math.round(((log.completedAt?.getTime() || log.startedAt.getTime()) - log.startedAt.getTime()) / 60000))} {messages.dashboard.min}
                        </span>
                        <span className="flex items-center gap-1">
                          <Dumbbell className="h-3.5 w-3.5" />
                          {log.exercises.length} {messages.dashboard.exercises}
                        </span>
                        {log.totalVolume ? <span>{log.totalVolume.toLocaleString()} {weightUnitLabel}</span> : null}
                      </div>
                    </div>

                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatDistanceToNow(log.completedAt || log.startedAt, {
                        addSuffix: true,
                        locale: locale === "vi" ? vi : enUS,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {log.comments.length > 0 ? (
                <div className="mt-4 space-y-2 pl-[3.75rem]">
                  {log.comments.slice(-2).map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        {comment.authorName}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
