"use client"

import { format } from "date-fns"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  Flame,
  Lightbulb,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { CoachInsightWindow, CoachTraineeInsight } from "@/lib/fitness/api"
import { coachInsightMessages, type CoachInsightCopy } from "@/lib/i18n/messages/coach-insight"
import { useCoachTraineeInsight, useCreateCoachTraineeInsight } from "@/lib/queries/coach"
import { cn } from "@/lib/utils"

const WINDOWS: CoachInsightWindow[] = [7, 14, 28]

const TONES = {
  good: { icon: CheckCircle2, className: "text-success-text" },
  info: { icon: Lightbulb, className: "text-primary" },
  warn: { icon: AlertTriangle, className: "text-warning-text" },
} as const

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`

/**
 * One-tap AI report on a trainee: the backend computes every figure for the
 * chosen window and the one before it, the AI writes the commentary and text
 * suggestions. Reading a saved report is free; only Analyze calls the AI.
 */
export function TraineeAIInsightPanel({ traineeId }: { traineeId: string }) {
  const { locale } = useLocale()
  const copy = coachInsightMessages[locale]
  const language = locale === "en" ? "en" : "vi"
  const [days, setDays] = useState<CoachInsightWindow>(14)
  const insightQuery = useCoachTraineeInsight(traineeId, days, language)
  const createInsight = useCreateCoachTraineeInsight(traineeId)
  const insight = insightQuery.data ?? null
  const analyzing = createInsight.isPending && createInsight.variables?.days === days
  const error = createInsight.error && createInsight.variables?.days === days ? createInsight.error.message || copy.error : null

  const analyze = () => createInsight.mutate({ days, locale: language })

  return (
    <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-md shadow-foreground/5 ring-1 ring-card/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Sparkles aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{copy.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
          </div>
        </div>

        <div role="radiogroup" aria-label={copy.windowLabel} className="flex shrink-0 gap-1 rounded-xl bg-muted p-1">
          {WINDOWS.map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={option === days}
              type="button"
              className={cn(
                "min-h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                option === days && "bg-card text-foreground shadow-sm",
              )}
              onClick={() => setDays(option)}
            >
              {copy.windowOption(option)}
            </button>
          ))}
        </div>
      </div>

      {insightQuery.isPending ? (
        <div className="flex justify-center py-8">
          <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : insight ? (
        <InsightReport analyzing={analyzing} copy={copy} insight={insight} otherLanguage={insight.locale !== language} onReanalyze={analyze} />
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
          <Button disabled={analyzing} type="button" onClick={analyze}>
            {analyzing ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            {analyzing ? copy.analyzing : copy.analyze}
          </Button>
        </div>
      )}

      {error ? <p className="text-sm text-destructive-text">{error}</p> : null}
    </section>
  )
}

function InsightReport({
  analyzing,
  copy,
  insight,
  onReanalyze,
  otherLanguage,
}: {
  analyzing: boolean
  copy: CoachInsightCopy
  insight: CoachTraineeInsight
  onReanalyze: () => void
  /** Written in the other language; offer to redo it in the coach's. */
  otherLanguage: boolean
}) {
  const needsRedo = insight.stale || otherLanguage
  const { current, previous, lifts, toTargetKg } = insight.findings
  const { metrics } = copy
  const sectionsByArea = insight.sections

  return (
    <div className={cn("space-y-5", analyzing && "opacity-60")}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{insight.summary}</p>
        <p className="text-xs text-muted-foreground">
          {insight.programNames.length > 0 ? copy.programs(insight.programNames.join(", ")) : copy.noProgram}
          {" · "}
          {current.start} → {current.end}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Dumbbell}
          label={metrics.adherence}
          value={current.training.adherencePct == null ? copy.noData : `${current.training.adherencePct}%`}
          delta={deltaOf(current.training.adherencePct, previous.training.adherencePct, "%")}
          vsPrevious={copy.vsPrevious}
          details={[
            current.training.planned > 0 ? metrics.adherenceDetail(Math.min(current.training.completed, current.training.planned), current.training.planned) : null,
            current.training.setsTotal > 0 ? metrics.sets(current.training.setsCompleted, current.training.setsTotal) : null,
            current.training.extraSessions > 0 ? metrics.extraSessions(current.training.extraSessions) : null,
          ]}
        />
        <Metric
          icon={Scale}
          label={metrics.weight}
          value={current.weight.last == null ? copy.noData : `${current.weight.last} kg`}
          details={[
            current.weight.change != null ? metrics.weightDetail(signed(current.weight.change)) : null,
            toTargetKg != null ? metrics.toTarget(signed(toTargetKg)) : null,
          ]}
        />
        <Metric
          icon={Flame}
          label={metrics.calories}
          value={current.nutrition.avgCalories == null ? copy.noData : `${current.nutrition.avgCalories} kcal`}
          delta={deltaOf(current.nutrition.avgCalories, previous.nutrition.avgCalories, " kcal")}
          vsPrevious={copy.vsPrevious}
          details={[
            current.nutrition.loggedDays > 0 ? metrics.caloriesDetail(current.nutrition.caloriePct, current.nutrition.loggedDays) : null,
            current.nutrition.avgProtein != null
              ? `${metrics.protein}: ${current.nutrition.avgProtein} g · ${metrics.proteinDetail(current.nutrition.proteinPct)}`
              : null,
          ]}
        />
        <Metric
          icon={Activity}
          label={metrics.readiness}
          value={current.recovery.avgReadiness == null ? copy.noData : `${current.recovery.avgReadiness}/100`}
          delta={deltaOf(current.recovery.avgReadiness, previous.recovery.avgReadiness)}
          vsPrevious={copy.vsPrevious}
          details={[
            current.recovery.avgSleepHours != null ? metrics.sleep(String(current.recovery.avgSleepHours)) : null,
            current.recovery.avgStress != null ? metrics.stress(current.recovery.avgStress) : null,
          ]}
        />
      </div>

      {lifts.length > 0 ? (
        <div>
          <p className="label-micro mb-2">{copy.liftsTitle}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {lifts.map((lift) => (
              <li key={lift.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{lift.name}</p>
                  <p className="text-xs text-muted-foreground">{copy.liftBest(lift.best.weight, lift.best.reps)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    lift.changePct == null ? "text-muted-foreground" : lift.changePct > 0 ? "text-success-text" : lift.changePct < 0 ? "text-warning-text" : "text-muted-foreground",
                  )}
                >
                  {lift.changePct == null ? copy.liftNew : `${signed(lift.changePct)}% e1RM`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="space-y-3">
        {sectionsByArea.map((section, index) => {
          const tone = TONES[section.tone]
          const Icon = tone.icon
          return (
            <li key={`${section.area}-${index}`} className="flex gap-2.5 text-sm text-foreground">
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.className)} />
              <span>
                <span className="font-semibold">{copy.areas[section.area]}: </span>
                {section.text}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="rounded-xl bg-primary-soft/50 p-4">
        <p className="text-sm font-semibold text-foreground">{copy.suggestionsTitle}</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
          {insight.suggestions.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">{copy.suggestionsNote}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className={cn("text-xs", needsRedo ? "text-warning-text" : "text-muted-foreground")}>
          {otherLanguage ? copy.otherLanguage : insight.stale ? copy.stale : copy.generatedAt(format(new Date(insight.generatedAt), "dd/MM HH:mm"))}
        </p>
        <Button disabled={analyzing} size="sm" type="button" variant={needsRedo ? "default" : "ghost"} onClick={onReanalyze}>
          {analyzing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
          {analyzing ? copy.analyzing : copy.reanalyze}
        </Button>
      </div>
    </div>
  )
}

function deltaOf(current: number | null, previous: number | null, unit = "") {
  if (current == null || previous == null) return null
  const change = Math.round(current - previous)
  return { text: `${signed(change)}${unit}`, tone: change === 0 ? "flat" : change > 0 ? "up" : "down" } as const
}

function Metric({
  delta,
  details,
  icon: Icon,
  label,
  value,
  vsPrevious,
}: {
  delta?: { text: string; tone: "up" | "down" | "flat" } | null
  details: Array<string | null>
  icon: LucideIcon
  label: string
  value: string
  vsPrevious?: string
}) {
  const lines = details.filter((line): line is string => Boolean(line))
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold text-foreground">{value}</p>
      {delta ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{delta.text}</span> {vsPrevious}
        </p>
      ) : null}
      {lines.map((line) => (
        <p key={line} className="mt-0.5 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  )
}
