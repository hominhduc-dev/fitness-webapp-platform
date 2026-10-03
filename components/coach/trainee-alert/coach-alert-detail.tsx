import { ArrowLeft, CheckCircle2, ChevronRight, MessageSquareText, TriangleAlert } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import type { CoachAlertDetail, CoachAlertSuggestion } from "@/lib/fitness/api"
import { ZONE_FILL, type VolumeZone } from "@/lib/fitness/progress-overview"
import type { AppLocale } from "@/lib/i18n/config"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

/**
 * One coach alert, with the evidence it was raised on and what to do next.
 * Everything is read from the alert detail; nothing here fetches or holds state.
 */

type Props = { detail: CoachAlertDetail; locale: AppLocale; messages: AppMessages }

const formatDay = (day: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${day}T00:00:00Z`))

const formatNumber = (value: number, locale: AppLocale) =>
  new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 }).format(value)

function Section({ children, title, hint }: { children: ReactNode; hint?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Suggestions({ detail, messages }: Omit<Props, "locale">) {
  const copy = messages.coachAlert
  const ordered = detail.suggestions.filter((suggestion): suggestion is Exclude<CoachAlertSuggestion, "resolved"> => suggestion !== "resolved")
  return (
    <Section title={copy.suggestionsTitle}>
      <ol className="space-y-3">
        {ordered.map((suggestion, index) => (
          <li key={suggestion} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{copy.suggestions[suggestion].title}</p>
              <p className="text-sm text-muted-foreground">{copy.suggestions[suggestion].body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-1 gap-2 @md:flex @md:flex-wrap">
        {detail.program ? (
          <Button asChild className="rounded-xl">
            <Link href={`/coach/programs/${detail.program.id}?adjustTrainee=${detail.trainee.id}`}>
              {copy.adjustPlan}
              <ChevronRight />
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="rounded-xl">
          <Link href={`/coach/trainees/${detail.trainee.id}`}>{copy.openTrainee}</Link>
        </Button>
      </div>
    </Section>
  )
}

function PlateauEvidence({ detail, locale, messages }: Props) {
  const plateau = detail.plateau
  if (!plateau) return null
  const copy = messages.coachAlert.plateau
  const muscleLabels = messages.volumeRecovery.muscleLabels as Record<string, string>
  const labelOf = (slug: string) => muscleLabels[slug] ?? slug

  return (
    <>
      <Section title={copy.liftsTitle} hint={plateau.readinessAverage != null ? copy.readiness(Math.round(plateau.readinessAverage)) : copy.noReadiness}>
        <ul className="space-y-4">
          {plateau.lifts.map((lift) => {
            const peak = Math.max(0, ...lift.weeks.map((week) => week.bestE1rm ?? 0))
            const since = lift.sinceAlert
            return (
              <li key={lift.key} className="rounded-xl bg-muted/50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 text-sm font-semibold text-foreground">{lift.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      since.progressed ? "bg-success-soft text-success-text" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {since.sessions === 0 ? copy.sinceNone : since.progressed ? copy.sinceProgressed : copy.sinceFlat}
                  </span>
                </div>
                {lift.primaryMuscles.length > 0 ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{lift.primaryMuscles.map(labelOf).join(" · ")}</p>
                ) : null}

                {/* e1RM per week from zero, so a flat lift reads flat. The oldest week is context, not judged. */}
                <div className="mt-3 grid grid-cols-4 gap-2" role="list">
                  {lift.weeks.map((week) => {
                    const height = week.bestE1rm && peak > 0 ? Math.max(8, (week.bestE1rm / peak) * 100) : 0
                    const context = week.weeksAgo >= 3
                    return (
                      <div key={week.weeksAgo} role="listitem" className="flex min-w-0 flex-col items-center gap-1 text-center">
                        <span className="text-xs font-semibold tnum text-foreground">
                          {week.bestE1rm != null ? formatNumber(week.bestE1rm, locale) : "–"}
                        </span>
                        <div className="flex h-16 w-full items-end justify-center rounded-md bg-card">
                          {height > 0 ? (
                            <div
                              className={cn("w-3/5 max-w-10 rounded-t-md", context ? "bg-muted-foreground/30" : "bg-warning")}
                              style={{ height: `${height}%` }}
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{copy.weeksAgo(week.weeksAgo)}</span>
                        <span className="text-[11px] tnum text-muted-foreground">
                          {week.topWeight != null && week.topReps != null
                            ? `${formatNumber(week.topWeight, locale)} × ${week.topReps}`
                            : week.sessions === 0 ? copy.noSession : "–"}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {copy.e1rm} (kg) · {copy.topSet} (kg × reps)
                </p>

                {since.sessions > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy.since}: {copy.sessions(since.sessions)}
                    {since.bestE1rm != null ? ` · ${copy.e1rm} ${formatNumber(since.bestE1rm, locale)}` : ""}
                  </p>
                ) : null}

                {lift.notes.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <MessageSquareText className="size-3.5" aria-hidden="true" />
                      {copy.notesTitle}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {lift.notes.map((note, index) => (
                        <li key={`${note.date}-${index}`} className="text-xs text-muted-foreground">
                          <span className="tnum">{formatDay(note.date, locale)}</span> · “{note.note}”
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Section>

      {plateau.muscles.length > 0 ? (
        <Section title={copy.musclesTitle} hint={copy.musclesHint}>
          <ul className="space-y-3">
            {plateau.muscles.map((muscle) => {
              const { mavMaxSets, mavMinSets, mevSets, mrvSets } = muscle.landmarks
              const scale = Math.max(mrvSets * 1.15, ...muscle.weeks.map((week) => week.effectiveSets))
              const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
              return (
                <li key={muscle.muscleSlug} className="rounded-xl bg-muted/50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{labelOf(muscle.muscleSlug)}</p>
                    <p className="font-mono text-[11px] tnum text-muted-foreground">
                      {messages.progressPage.overview.zones.landmarks(mevSets, mavMinSets, mavMaxSets, mrvSets)}
                      {muscle.landmarks.source !== "coach" ? ` · ${copy.estimated}` : ""}
                    </p>
                  </div>
                  {muscle.weeks.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">{copy.noVolume}</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {muscle.weeks.map((week) => (
                        <li key={week.weekStart} className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
                          <span className="text-[11px] tnum text-muted-foreground">{formatDay(week.weekStart, locale)}</span>
                          {/* The productive band shaded, MRV marked, this week's sets as the bar. */}
                          <div className="relative h-2.5 rounded-full bg-border" aria-hidden="true">
                            <div className="absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--success)_30%,transparent)]" style={{ left: pct(mavMinSets), right: `calc(100% - ${pct(mavMaxSets)})` }} />
                            <div className="absolute inset-y-0 left-0 rounded-full" style={{ background: ZONE_FILL[week.zone as VolumeZone], width: pct(week.effectiveSets) }} />
                            <div className="absolute inset-y-[-3px] w-px bg-destructive" style={{ left: pct(mrvSets) }} />
                          </div>
                          <span className="text-right text-[11px] tnum text-foreground">
                            {copy.setsWeek(week.effectiveSets)}
                            <span className="block text-muted-foreground">{messages.volumeRecovery.zones[week.zone]}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      ) : null}
    </>
  )
}

function MissedEvidence({ detail, locale, messages }: Props) {
  const missed = detail.missedWorkouts
  if (!missed) return null
  const copy = messages.coachAlert.missed
  const top = Math.max(missed.planned, ...missed.weeks.map((week) => week.completed), 1)

  return (
    <>
      <Section title={copy.title} hint={copy.planned(missed.planned)}>
        <div className="grid grid-cols-4 gap-2" role="list">
          {missed.weeks.map((week) => (
            <div key={week.weeksAgo} role="listitem" className="flex flex-col items-center gap-1 text-center">
              <span className="text-xs font-semibold tnum text-foreground">{week.completed}/{missed.planned}</span>
              {/* The dashed line is the plan; the bar is what was done. */}
              <div className="relative flex h-20 w-full items-end justify-center rounded-md bg-muted/50">
                <div className="absolute inset-x-1 border-t border-dashed border-muted-foreground/60" style={{ bottom: `${(missed.planned / top) * 100}%` }} aria-hidden="true" />
                <div
                  className={cn("w-3/5 max-w-10 rounded-t-md", week.weeksAgo === 0 ? "bg-warning" : "bg-muted-foreground/30")}
                  style={{ height: `${(week.completed / top) * 100}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{copy.weekLabel(week.weeksAgo)}</span>
            </div>
          ))}
        </div>
        {missed.sinceAlert > 0 ? <p className="mt-3 text-xs text-muted-foreground">{copy.since(missed.sinceAlert)}</p> : null}
      </Section>

      <Section title={copy.sessionsTitle}>
        {missed.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.noSessions}</p>
        ) : (
          <ul className="divide-y divide-border">
            {missed.sessions.map((session, index) => (
              <li key={`${session.date}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">{session.workoutName ?? "–"}</span>
                <span className="shrink-0 tnum text-muted-foreground">{formatDay(session.date, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function ReadinessEvidence({ detail, locale, messages }: Props) {
  const readiness = detail.lowReadiness
  if (!readiness) return null
  const copy = messages.coachAlert.readiness

  return (
    <Section title={copy.title} hint={copy.threshold(readiness.threshold)}>
      {readiness.checkIns.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.noCheckIns}</p>
      ) : (
        <>
          {/* One bar per check-in on a 0–100 scale; the dashed line is the alert threshold. */}
          <div className="relative flex h-24 items-end gap-1 rounded-md bg-muted/50 px-1" aria-hidden="true">
            <div className="absolute inset-x-0 border-t border-dashed border-warning" style={{ bottom: `${readiness.threshold}%` }} />
            {readiness.checkIns.map((checkIn) => (
              <div
                key={checkIn.date}
                className={cn(
                  "min-w-0 flex-1 rounded-t-sm",
                  checkIn.readiness == null ? "bg-transparent" : checkIn.readiness < readiness.threshold ? "bg-warning" : "bg-success",
                  checkIn.sinceAlert && "opacity-60",
                )}
                style={{ height: `${checkIn.readiness ?? 0}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {readiness.checkIns.slice().reverse().map((checkIn) => (
              <li key={checkIn.date} className="py-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="tnum text-foreground">
                    {formatDay(checkIn.date, locale)}
                    {checkIn.sinceAlert ? <span className="ml-1.5 text-[11px] text-muted-foreground">({copy.sinceAlert})</span> : null}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tnum",
                      checkIn.readiness == null
                        ? "bg-muted text-muted-foreground"
                        : checkIn.readiness < readiness.threshold ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text",
                    )}
                  >
                    {checkIn.readiness ?? "–"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    `${copy.fatigue} ${checkIn.fatigue}/5`,
                    checkIn.sleepMinutes != null ? `${copy.sleep} ${copy.hours(checkIn.sleepMinutes)}` : null,
                    checkIn.stress != null ? `${copy.stress} ${checkIn.stress}/5` : null,
                    checkIn.maxSoreness != null ? `${copy.soreness} ${checkIn.maxSoreness}/5` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                {checkIn.note ? <p className="mt-0.5 text-xs text-foreground">“{checkIn.note}”</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

function CoachAlertDetailView({ detail, locale, messages }: Props) {
  const copy = messages.coachAlert
  const name = detail.trainee.name
  const resolved = detail.suggestions.includes("resolved")
  const headline = detail.kind === "plateau"
    ? copy.headline.plateau(name, detail.plateau?.lifts.length ?? 0)
    : detail.kind === "missed_workouts" ? copy.headline.missed_workouts(name) : copy.headline.low_readiness(name)
  const why = detail.kind === "low_readiness" ? copy.why.low_readiness(detail.lowReadiness?.threshold ?? 50) : copy.why[detail.kind]
  const raisedAt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(detail.raisedAt))

  return (
    <div className="space-y-4">
      <Link href={`/coach/trainees/${detail.trainee.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {copy.back(name)}
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning-text">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {copy.kind[detail.kind]}
          </span>
          <span className="text-xs text-muted-foreground">{copy.raised(raisedAt)}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground @lg:text-2xl">{headline}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{why}</p>
        {resolved ? (
          <div className="mt-3 flex gap-2 rounded-xl bg-success-soft p-3 text-success-text">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{copy.suggestions.resolved.title}</p>
              <p className="text-xs">{copy.suggestions.resolved.body}</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @4xl:items-start">
        <div className="min-w-0 space-y-4">
          <PlateauEvidence detail={detail} locale={locale} messages={messages} />
          <MissedEvidence detail={detail} locale={locale} messages={messages} />
          <ReadinessEvidence detail={detail} locale={locale} messages={messages} />
        </div>
        {/* Phones read what to do first, right under the alert; wide screens keep it beside the evidence. */}
        <div className="order-first min-w-0 @4xl:order-none @4xl:sticky @4xl:top-4">
          <Suggestions detail={detail} messages={messages} />
        </div>
      </div>
    </div>
  )
}

export { CoachAlertDetailView }
