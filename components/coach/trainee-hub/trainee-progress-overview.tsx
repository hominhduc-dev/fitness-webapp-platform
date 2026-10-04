"use client"

import { Activity, BellRing, ChevronRight, Dumbbell, Gauge, ListChecks, Scale, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useMemo, useSyncExternalStore, type ReactNode } from "react"

import { ConsistencyCard } from "@/components/progress/overview/consistency-card"
import { MuscleZoneCard } from "@/components/progress/overview/muscle-zone-card"
import { Sparkline } from "@/components/progress/overview/sparkline"
import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import type { CoachTraineeProgressOverview } from "@/lib/fitness/api"
import { buildConsistencyGrid, buildStrengthCards } from "@/lib/fitness/progress-overview"
import { buildWeightTrend } from "@/lib/fitness/weight-trend"
import { useCoachTraineeProgress } from "@/lib/queries/coach"
import { cn } from "@/lib/utils"

/**
 * A trainee's progress as their coach reads it, most actionable first: what
 * needs attention, whether the program is producing strength, which muscles
 * are under- or over-dosed, how recovery is trending, whether the trainee
 * follows the engine, how consistent they are, and where body weight is going.
 */

type Messages = ReturnType<typeof useLocale>["messages"]
type Data = CoachTraineeProgressOverview

const LOW_READINESS = 50
const STRENGTH_LIFTS = 6

function subscribeToNothing() {
  return () => {}
}

/** Today on the client only, so the consistency grid never renders a day the browser disagrees with. */
function useClientToday() {
  return useSyncExternalStore(subscribeToNothing, () => new Date().toDateString(), () => null)
}

function Block({ children, className, hint, icon, title }: { children: ReactNode; className?: string; hint?: string; icon: ReactNode; title: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5", className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h2>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  )
}

function alertHref(traineeId: string, alert: Data["alerts"][number]) {
  return `/coach/trainees/${traineeId}/alerts/${alert.kind}?week=${alert.weekStart}`
}

function AlertsBlock({ data, messages, traineeId }: { data: Data; messages: Messages; traineeId: string }) {
  const copy = messages.coachProgress.alerts
  const describe = messages.notificationCenter.copy.coachTraineeAlert
  const message = (alert: Data["alerts"][number]) => {
    if (alert.kind === "plateau") return describe.plateau(alert.exercises.join(", "))
    if (alert.kind === "missed_workouts") return describe.missedWorkouts(alert.completed ?? 0, alert.planned ?? 0)
    return describe.lowReadiness(alert.days ?? 0, alert.averageReadiness ?? 0)
  }

  return (
    <Block icon={<BellRing />} title={copy.title} className="@4xl:col-span-2">
      {data.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alertHref(traineeId, alert)} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-foreground">
                <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-text">
                  {messages.coachAlert.kind[alert.kind]}
                </span>
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  {message(alert)}
                  {!alert.read ? <span className="ml-1.5 text-[11px] font-semibold text-primary">{copy.unread}</span> : null}
                </span>
                <span className="flex shrink-0 items-center text-xs text-muted-foreground">
                  {copy.open}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

function StrengthBlock({ data, locale, messages, traineeId }: { data: Data; locale: string; messages: Messages; traineeId: string }) {
  const copy = messages.coachProgress.strength
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const cards = useMemo(
    () => buildStrengthCards(data.dashboard.strengthProgress, data.dashboard.recentPRs.map((pr) => pr.exerciseName), STRENGTH_LIFTS)
      .filter((card) => card.values.length > 0),
    [data.dashboard],
  )
  const plateauAlert = (name: string) => data.alerts.find((alert) => alert.kind === "plateau" && alert.exercises.includes(name))

  return (
    <Block icon={<TrendingUp />} title={copy.title} hint={copy.hint}>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {cards.map((card) => {
            const status = data.liftStatuses[card.exerciseName] ?? "insufficient_data"
            const alert = status === "stalled" ? plateauAlert(card.exerciseName) : undefined
            const chip = (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10.5px] font-semibold",
                  status === "progressing" && "bg-success-soft text-success-text",
                  status === "stalled" && "bg-warning-soft text-warning-text",
                  status === "insufficient_data" && "bg-muted text-muted-foreground",
                )}
              >
                {copy.status[status]}
                {alert ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
              </span>
            )
            return (
              <li key={card.key} className="flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{card.exerciseName}</span>
                    {alert ? <Link href={alertHref(traineeId, alert)}>{chip}</Link> : chip}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {card.current == null ? "—" : number.format(card.current)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>
                    {card.changePct != null ? (
                      <span
                        className={cn(
                          "ml-2 text-xs font-semibold tnum",
                          card.changePct > 0 ? "text-success-text" : card.changePct < 0 ? "text-destructive-text" : "text-muted-foreground",
                        )}
                      >
                        {card.changePct > 0 ? "▲ +" : card.changePct < 0 ? "▼ " : ""}{card.changePct}%
                      </span>
                    ) : null}
                  </p>
                </div>
                <Sparkline values={card.values} className="h-8 w-20 shrink-0 text-primary" />
              </li>
            )
          })}
        </ul>
      )}
    </Block>
  )
}

function VolumeBlock({ data, messages }: { data: Data; messages: Messages }) {
  const copy = messages.coachProgress.volume
  const labels = messages.volumeRecovery.muscleLabels as Record<string, string>
  const muscles = data.volume?.muscles ?? []
  const changes = muscles.filter((muscle) => muscle.recommendation.action !== "maintain")

  return (
    <Block icon={<Dumbbell />} title={copy.title} hint={copy.hint}>
      {muscles.every((muscle) => muscle.effectiveSets <= 0) ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <MuscleZoneCard muscles={muscles} />
      )}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">{copy.changesTitle}</p>
        {changes.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">{copy.noChanges}</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {changes.map((muscle) => (
              <li key={muscle.muscleSlug} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
                <span className="min-w-0 text-foreground">
                  <span className="font-medium">{labels[muscle.muscleSlug] ?? muscle.muscleSlug}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {messages.trainingRecommendation.muscle[muscle.recommendation.action]} ·{" "}
                    {copy.sets(muscle.recommendation.currentSets, muscle.recommendation.recommendedSets)}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10.5px] font-semibold",
                    muscle.recommendation.status === "dismissed" ? "bg-warning-soft text-warning-text"
                      : muscle.recommendation.status === "pending" ? "bg-muted text-muted-foreground"
                        : "bg-success-soft text-success-text",
                  )}
                >
                  {copy.status[muscle.recommendation.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Block>
  )
}

function ReadinessBlock({ data, locale, messages }: { data: Data; locale: string; messages: Messages }) {
  const copy = messages.coachProgress.readiness
  const entries = data.recovery.entries.slice().sort((left, right) => left.checkInDate.localeCompare(right.checkInDate))
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })
  const average = data.recovery.averages.readinessScore
  const sleep = data.recovery.averages.sleepMinutes

  return (
    <Block icon={<Gauge />} title={copy.title}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {average != null ? <span className="font-semibold text-foreground">{copy.average(Math.round(average))}</span> : null}
            {sleep != null ? <span className="text-muted-foreground">{copy.sleep(Math.round((sleep / 60) * 10) / 10)}</span> : null}
          </div>
          {/* One bar per check-in on a 0–100 scale; below the alert line reads as a warning. */}
          <div className="relative mt-3 flex h-24 items-end gap-1 rounded-md bg-muted/50 px-1" role="img" aria-label={copy.title}>
            <div className="absolute inset-x-0 border-t border-dashed border-warning" style={{ bottom: `${LOW_READINESS}%` }} aria-hidden="true" />
            {entries.map((entry) => (
              <div
                key={entry.checkInDate}
                title={`${day.format(new Date(`${entry.checkInDate}T00:00:00Z`))}: ${entry.readinessScore ?? "–"}`}
                className={cn(
                  "min-w-0 flex-1 rounded-t-sm",
                  entry.readinessScore == null ? "bg-transparent" : entry.readinessScore < LOW_READINESS ? "bg-warning" : "bg-success",
                )}
                style={{ height: `${entry.readinessScore ?? 0}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] tnum text-muted-foreground">
            <span>{day.format(new Date(`${entries[0].checkInDate}T00:00:00Z`))}</span>
            <span>{day.format(new Date(`${entries.at(-1)!.checkInDate}T00:00:00Z`))}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{copy.threshold}</p>
        </>
      )}
    </Block>
  )
}

function ComplianceBlock({ data, messages }: { data: Data; messages: Messages }) {
  const copy = messages.coachProgress.compliance
  // Versions are summed: the coach asks how the trainee follows, not which engine build.
  const rows = useMemo(() => {
    const byAction = new Map<string, { followed: number; modified: number; notAttempted: number; partial: number; rolledBack: number; judged: number; shown: number }>()
    for (const row of data.telemetry) {
      const entry = byAction.get(row.action) ?? { followed: 0, judged: 0, modified: 0, notAttempted: 0, partial: 0, rolledBack: 0, shown: 0 }
      entry.followed += row.compliance.followed
      entry.partial += row.compliance.partial
      entry.modified += row.compliance.modified
      entry.notAttempted += row.compliance.not_attempted
      entry.rolledBack += row.outcomes.rolled_back
      entry.judged += row.outcomes.successful + row.outcomes.maintained + row.outcomes.regressed + row.outcomes.rolled_back
      entry.shown += row.shown
      byAction.set(row.action, entry)
    }
    return Array.from(byAction.entries()).sort((left, right) => right[1].shown - left[1].shown)
  }, [data.telemetry])

  const segments = [
    { className: "bg-success", key: "followed", label: copy.followed },
    { className: "bg-success/40", key: "partial", label: copy.partial },
    { className: "bg-warning", key: "modified", label: copy.modified },
    { className: "bg-muted-foreground/40", key: "notAttempted", label: copy.notAttempted },
  ] as const

  return (
    <Block icon={<ListChecks />} title={copy.title} hint={copy.hint}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map(([action, row]) => {
              const evaluated = row.followed + row.partial + row.modified + row.notAttempted
              return (
                <li key={action}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{copy.action[action as keyof typeof copy.action] ?? action}</span>
                    <span className="text-xs text-muted-foreground">{copy.shown(row.shown)}</span>
                  </div>
                  {evaluated > 0 ? (
                    <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
                      {segments.map((segment) => (
                        <div key={segment.key} className={segment.className} style={{ width: `${(row[segment.key] / evaluated) * 100}%` }} />
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-[11px] tnum text-muted-foreground">
                    {evaluated > 0 ? segments.map((segment) => `${segment.label} ${Math.round((row[segment.key] / evaluated) * 100)}%`).join(" · ") : null}
                    {row.judged > 0 ? `${evaluated > 0 ? " · " : ""}${copy.rollback(Math.round((row.rolledBack / row.judged) * 100))}` : null}
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Block>
  )
}

function ConsistencyBlock({ data, messages }: { data: Data; messages: Messages }) {
  const today = useClientToday()
  const grid = useMemo(() => (today ? buildConsistencyGrid(data.consistencyDays, new Date(today), 12) : null), [data.consistencyDays, today])
  return (
    <Block icon={<Activity />} title={messages.coachProgress.consistency.title}>
      {grid ? <ConsistencyCard activeDays={grid.activeDays} columns={grid.columns} weekStreak={grid.weekStreak} /> : <Skeleton className="h-28 rounded-xl" />}
    </Block>
  )
}

function WeightBlock({ data, locale, messages }: { data: Data; locale: string; messages: Messages }) {
  const copy = messages.coachProgress.weight
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "auto" })
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" })
  const entries = useMemo(
    () => data.bodyMetrics.filter((entry) => typeof entry.weightKg === "number").sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime()),
    [data.bodyMetrics],
  )
  const trend = useMemo(() => buildWeightTrend(entries), [entries])
  const values = entries.slice(0, 30).reverse().map((entry) => entry.weightKg as number)
  const toGoal = data.targetWeightKg != null && trend.sevenDayAverageKg != null ? data.targetWeightKg - trend.sevenDayAverageKg : null

  return (
    <Block icon={<Scale />} title={copy.title}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <div className="flex items-end gap-4">
          <dl className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            {[
              [copy.average, trend.sevenDayAverageKg != null ? `${number.format(trend.sevenDayAverageKg)} kg` : "—"],
              [copy.rate, trend.ratePerWeekKg != null ? `${signed.format(trend.ratePerWeekKg)} kg` : "—"],
              [copy.toGoal, toGoal != null ? `${signed.format(Math.round(toGoal * 10) / 10)} kg` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
                <dd className="text-sm font-semibold tnum text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <Sparkline values={values} className="h-10 w-24 shrink-0 text-primary" />
        </div>
      )}
    </Block>
  )
}

export function TraineeProgressOverview({ traineeId }: { traineeId: string }) {
  const { locale, messages } = useLocale()
  const query = useCoachTraineeProgress(traineeId)

  if (query.isPending) {
    return (
      <div className="grid gap-4 @4xl:grid-cols-2">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-48 rounded-2xl" />)}
      </div>
    )
  }
  if (query.isError || !query.data) {
    return <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{messages.coachProgress.loadError}</p>
  }

  const data = query.data
  return (
    <div className="grid gap-4 @4xl:grid-cols-2">
      <AlertsBlock data={data} messages={messages} traineeId={traineeId} />
      <StrengthBlock data={data} locale={locale} messages={messages} traineeId={traineeId} />
      <VolumeBlock data={data} messages={messages} />
      <ReadinessBlock data={data} locale={locale} messages={messages} />
      <ComplianceBlock data={data} messages={messages} />
      <ConsistencyBlock data={data} messages={messages} />
      <WeightBlock data={data} locale={locale} messages={messages} />
    </div>
  )
}
