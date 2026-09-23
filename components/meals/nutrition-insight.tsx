"use client"

import { format } from "date-fns"
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import type { NutritionInsight as NutritionInsightData } from "@/lib/fitness/api"
import { useCreateNutritionInsight, useNutritionInsight } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"

const TONES = {
  good: { icon: CheckCircle2, className: "text-success-text" },
  info: { icon: Lightbulb, className: "text-primary" },
  warn: { icon: AlertTriangle, className: "text-warning-text" },
} as const

/**
 * AI Nutrition Insight, behind a small icon button that sits in the corner of
 * the day's calorie card. Reading the saved insight is free; the AI only runs
 * when the trainee presses Analyze, and the result is kept for the day until
 * what they logged changes. A dot on the button means there is one to read.
 */
export function NutritionInsightButton({
  className,
  dateKey,
  hasIntake,
  onPickFood,
}: {
  className?: string
  dateKey: string
  hasIntake: boolean
  onPickFood: (foodId: string) => void
}) {
  const { locale, messages } = useLocale()
  const labels = messages.meals
  const [open, setOpen] = useState(false)
  const insightQuery = useNutritionInsight(dateKey)
  const createInsight = useCreateNutritionInsight(dateKey)
  const insight = insightQuery.data
  const analyzing = createInsight.isPending
  const error = createInsight.error ? createInsight.error.message || labels.insightError : null

  const analyze = () => createInsight.mutate(locale === "en" ? "en" : "vi")

  return (
    <>
      <button
        aria-label={labels.insightTitle}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
        title={labels.insightTitle}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-4" />
        {insight ? (
          <span
            aria-hidden="true"
            className={cn("absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-card", insight.stale ? "bg-warning" : "bg-primary")}
          />
        ) : null}
      </button>

      {open ? (
        <BottomSheet ariaLabel={labels.insightTitle} className="sm:max-w-[520px]" onClose={() => setOpen(false)}>
          <BottomSheetHeader>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Sparkles className="size-4" />
              </div>
              <h2 className="truncate text-base font-semibold text-foreground">{labels.insightTitle}</h2>
            </div>
            <button
              aria-label={messages.common.cancel}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              type="button"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </BottomSheetHeader>

          <BottomSheetBody className="space-y-4">
            {insight ? (
              <InsightBody
                analyzing={analyzing}
                insight={insight}
                labels={labels}
                locale={locale}
                onPickFood={(foodId) => {
                  setOpen(false)
                  onPickFood(foodId)
                }}
                onReanalyze={analyze}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{labels.insightDescription}</p>
                <Button className="w-full" disabled={!hasIntake || analyzing || insightQuery.isPending} type="button" onClick={analyze}>
                  {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {analyzing ? labels.insightAnalyzing : labels.insightAnalyze}
                </Button>
                {!hasIntake ? <p className="text-center text-xs text-muted-foreground">{labels.insightNeedsIntake}</p> : null}
              </div>
            )}
            {error ? <p className="text-sm text-destructive-text">{error}</p> : null}
          </BottomSheetBody>
        </BottomSheet>
      ) : null}
    </>
  )
}

function InsightBody({
  analyzing,
  insight,
  labels,
  locale,
  onPickFood,
  onReanalyze,
}: {
  analyzing: boolean
  insight: NutritionInsightData
  labels: {
    insightAnalyzing: string
    insightGeneratedAt: (time: string) => string
    insightReanalyze: string
    insightStale: string
    insightSuggested: string
  }
  locale: string
  onPickFood: (foodId: string) => void
  onReanalyze: () => void
}) {
  return (
    <div className={cn("space-y-4", analyzing && "opacity-60")}>
      <p className="text-sm font-medium text-foreground">{insight.summary}</p>

      <ul className="space-y-2.5">
        {insight.points.map((point, index) => {
          const tone = TONES[point.tone]
          const Icon = tone.icon
          return (
            <li key={index} className="flex gap-2.5 text-sm text-foreground">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone.className)} />
              <span>{point.text}</span>
            </li>
          )
        })}
      </ul>

      {insight.suggestedFoods.length > 0 ? (
        <div>
          <p className="label-micro mb-2">{labels.insightSuggested}</p>
          <div className="flex flex-wrap gap-1.5">
            {insight.suggestedFoods.map((food) => (
              <button
                key={food.id}
                className="rounded-full border border-primary/30 bg-primary-soft/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
                type="button"
                onClick={() => onPickFood(food.id)}
              >
                + {locale === "en" && food.nameEn ? food.nameEn : food.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className={cn("text-xs", insight.stale ? "text-warning-text" : "text-muted-foreground")}>
          {insight.stale ? labels.insightStale : labels.insightGeneratedAt(format(new Date(insight.generatedAt), "HH:mm"))}
        </p>
        <Button disabled={analyzing} size="sm" type="button" variant={insight.stale ? "default" : "ghost"} onClick={onReanalyze}>
          {analyzing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {analyzing ? labels.insightAnalyzing : labels.insightReanalyze}
        </Button>
      </div>
    </div>
  )
}
