"use client"

import Link from "next/link"
import { ChevronRight, Utensils } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { DailyNutrition } from "@/lib/types"

interface NutritionSummaryProps {
  nutrition: DailyNutrition
}

/**
 * Phones show this card as a square beside the readiness card, so below `sm`
 * the donut shrinks, the calorie figures stack and the meal slots tighten.
 */
export function NutritionSummary({ nutrition }: NutritionSummaryProps) {
  const { messages } = useLocale()
  const formatCalories = (value: number) => Math.round(value).toLocaleString("en-US")
  const percentage =
    nutrition.targetCalories > 0
      ? Math.min(100, Math.round((nutrition.totalCalories / nutrition.targetCalories) * 100))
      : 0
  const remaining = Math.max(0, nutrition.targetCalories - nutrition.totalCalories)

  // SVG donut params
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const arc = (percentage / 100) * circumference

  return (
    <Link href="/meals" className="block h-full min-w-0">
      <div className="glass-card flex aspect-square h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/25 sm:aspect-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
            <span className="sm:hidden">{messages.shell.nutrition}</span>
            <span className="hidden sm:inline">{messages.dashboard.todaysNutrition}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-none sm:justify-start">
          {/* Donut + calories */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="relative aspect-square size-12 shrink-0 rounded-full sm:size-14">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                aria-label={`${percentage}%`}
                className="block aspect-square size-full -rotate-90 overflow-visible"
              >
                <circle
                  cx="50" cy="50" r={radius}
                  stroke="currentColor" strokeWidth="8" fill="none"
                  className="text-muted"
                />
                {percentage > 0 && (
                  <circle
                    cx="50" cy="50" r={radius}
                    stroke="currentColor" strokeWidth="8" fill="none"
                    strokeDasharray={`${arc} ${circumference}`}
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xs font-semibold tnum text-foreground sm:text-sm">
                  {percentage}%
                </span>
              </div>
            </div>

            <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-2">
              <div className="min-w-0">
                <p className="label-micro mb-0.5 truncate">{messages.dashboard.consumed}</p>
                <p className="truncate font-mono text-xs font-semibold leading-none tnum text-foreground sm:text-base">
                  {formatCalories(nutrition.totalCalories)}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground sm:text-xs">kcal</span>
                </p>
              </div>
              <div className="min-w-0">
                <p className="label-micro mb-0.5 truncate">{messages.dashboard.remaining}</p>
                <p className="truncate font-mono text-xs font-semibold leading-none tnum text-primary sm:text-base">
                  {formatCalories(remaining)}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground sm:text-xs">kcal</span>
                </p>
              </div>
            </div>
          </div>

          {/* Meal slots */}
          <div className="grid min-w-0 grid-cols-2 gap-1 sm:gap-1.5">
            {[
              { key: "breakfast", label: messages.dashboard.breakfast },
              { key: "lunch",     label: messages.dashboard.lunch },
              { key: "dinner",    label: messages.dashboard.dinner },
              { key: "snack",     label: messages.dashboard.snack },
            ].map((mealType) => {
              const meal = nutrition.meals.find((entry) => entry.type === mealType.key)
              return (
                <div
                  key={mealType.key}
                  className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-surface-subtle px-1.5 py-1 sm:gap-2 sm:px-2.5"
                >
                  <span className="min-w-0 truncate text-[10px] text-muted-foreground sm:text-xs">{mealType.label}</span>
                  <span className={meal ? "font-mono text-[10px] font-medium tnum text-foreground sm:text-xs" : "font-mono text-[10px] text-muted-foreground sm:text-xs"}>
                    {meal ? formatCalories(meal.calories) : "—"}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Log meal hint — the whole card is the link, so phones skip it. */}
          <div className="hidden items-center gap-2 border-t border-border pt-1.5 text-xs text-muted-foreground sm:flex">
            <Utensils className="h-3.5 w-3.5 shrink-0" />
            <span>Tap to log a meal</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
