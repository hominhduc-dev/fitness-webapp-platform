"use client"

import { format } from "date-fns"
import { Clock3, History, Loader2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { Meal } from "@/lib/types"

type MealHistoryListProps = {
  isLoading?: boolean
  isLoadingMore?: boolean
  meals: Meal[]
  nextCursor?: string
  onLoadMore?: () => void
}

function formatMetric(value?: number, fractionDigits = 1) {
  if (value == null) {
    return undefined
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits)
}

export function MealHistoryList({
  isLoading = false,
  isLoadingMore = false,
  meals,
  nextCursor,
  onLoadMore,
}: MealHistoryListProps) {
  const { locale, messages } = useLocale()

  const mealTypeLabel: Record<Meal["type"], string> = {
    breakfast: messages.meals.breakfast,
    dinner: messages.meals.dinner,
    lunch: messages.meals.lunch,
    snack: messages.meals.snack,
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {messages.meals.historyLoading}
      </div>
    )
  }

  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {messages.meals.historyEmpty}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">{messages.meals.historyTitle}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{messages.meals.historySubtitle}</p>
        </div>
      </div>

      <div className="space-y-3">
        {meals.map((meal) => (
          <article
            key={meal.id}
            className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-[#f8fbff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{meal.name}</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {mealTypeLabel[meal.type]}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {format(meal.time, locale === "en" ? "EEE, MMM d • h:mm a" : "EEE, dd/MM • HH:mm")}
                </span>
                {meal.weightGrams ? <span>{`${formatMetric(meal.weightGrams)}g`}</span> : null}
                {meal.protein || meal.carbs || meal.fat ? (
                  <span>{`${formatMetric(meal.protein || 0)}P / ${formatMetric(meal.carbs || 0)}C / ${formatMetric(meal.fat || 0)}F`}</span>
                ) : null}
                {meal.fiber != null ? <span>{`Fiber ${formatMetric(meal.fiber)}g`}</span> : null}
              </div>
            </div>

            <div className="shrink-0 text-sm font-semibold text-foreground">{Math.round(meal.calories)} kcal</div>
          </article>
        ))}
      </div>

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button
            disabled={isLoadingMore}
            type="button"
            variant="outline"
            onClick={() => onLoadMore?.()}
          >
            {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {messages.meals.loadMoreHistory}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
