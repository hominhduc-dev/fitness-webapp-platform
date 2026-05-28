"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import type { WorkoutLog } from "@/lib/types"

// ---------------------------------------------------------------------------
// Kind color map — matches workout page / progress page
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
  push:      "var(--chart-1)",
  pull:      "var(--chart-3)",
  legs:      "var(--chart-4)",
  full_body: "var(--chart-2)",
  cardio:    "var(--chart-5, var(--chart-2))",
}

function kindColor(kind?: string | null) {
  return kind ? (KIND_COLORS[kind] ?? "var(--border)") : "var(--border)"
}

// ---------------------------------------------------------------------------
// Single activity row
// ---------------------------------------------------------------------------

function ActivityRow({
  log,
  weightUnitLabel,
  locale,
  messages,
}: {
  log: WorkoutLog
  weightUnitLabel: string
  locale: string
  messages: ReturnType<typeof useLocale>["messages"]
}) {
  const kColor = kindColor(log.workout.kind)
  const startedAt = log.startedAt
  const completedAt = log.completedAt

  const durationMins =
    completedAt
      ? Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000))
      : null

  const ago = formatDistanceToNow(completedAt ?? startedAt, {
    addSuffix: true,
    locale: locale === "vi" ? vi : enUS,
  })

  const dayNum = startedAt.getDate()
  const monthShort = startedAt.toLocaleDateString("en-US", { month: "short" })

  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3.5">
        {/* Date column */}
        <div className="w-8 shrink-0 text-center">
          <div className="label-micro leading-tight">{monthShort}</div>
          <div className="font-mono text-[17px] font-semibold leading-tight tnum text-foreground">
            {dayNum}
          </div>
        </div>

        {/* Kind bar */}
        <div className="h-8 w-0.5 shrink-0 rounded-sm" style={{ background: kColor }} />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{log.workout.name}</p>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] tnum text-muted-foreground">
            {durationMins && (
              <span>{durationMins} {messages.dashboard.min}</span>
            )}
            <span>{log.exercises.length} {messages.dashboard.exercises}</span>
            {log.totalVolume ? (
              <span>
                {log.totalVolume >= 1000
                  ? `${(log.totalVolume / 1000).toFixed(1)}k`
                  : Math.round(log.totalVolume)}{" "}
                {weightUnitLabel}
              </span>
            ) : null}
            <span className="ml-auto">{ago}</span>
          </div>
        </div>

        {/* Coach comments badge */}
        {log.comments.length > 0 && (
          <div className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-primary">
            {log.comments.length} note{log.comments.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Inline coach comments */}
      {log.comments.length > 0 && (
        <div className="mt-3 space-y-2 pl-[3.25rem]">
          {log.comments.slice(-2).map((comment) => (
            <div
              key={comment.id}
              className="rounded-[8px] border border-border bg-muted px-3 py-2.5"
            >
              <p className="label-micro text-primary">{comment.authorName}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

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
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="label-micro">{title ?? messages.dashboard.recentActivity}</span>
        <span className="font-mono text-[11px] tnum text-muted-foreground">{logs.length}</span>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? messages.dashboard.noRecentWorkouts}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <ActivityRow
              key={log.id}
              log={log}
              locale={locale}
              messages={messages}
              weightUnitLabel={weightUnitLabel}
            />
          ))}
        </div>
      )}
    </section>
  )
}
