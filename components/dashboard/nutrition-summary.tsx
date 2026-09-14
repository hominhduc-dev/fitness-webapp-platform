"use client"

import Link from "next/link"
import { ChevronRight, Utensils } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { DailyNutrition } from "@/lib/types"

interface NutritionSummaryProps {
  nutrition: DailyNutrition
}

export function NutritionSummary({ nutrition }: NutritionSummaryProps) {
  const { messages } = useLocale()
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
      <div className="glass-card h-full min-w-0 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/25">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold text-foreground">{messages.dashboard.todaysNutrition}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="mt-2 flex min-w-0 flex-col gap-2">
          {/* Donut + calories */}
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Donut */}
            <div className="relative aspect-square size-14 shrink-0 rounded-full">
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
                <span className="font-mono text-sm font-semibold tnum text-foreground">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Numbers */}
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <div>
                <p className="label-micro mb-0.5">{messages.dashboard.consumed}</p>
                <p className="font-mono text-base font-semibold leading-none tnum text-foreground">
                  {nutrition.totalCalories.toLocaleString("en-US")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
              <div>
                <p className="label-micro mb-0.5">{messages.dashboard.remaining}</p>
                <p className="font-mono text-base font-semibold leading-none tnum text-primary">
                  {remaining.toLocaleString("en-US")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
            </div>
          </div>

          {/* Meal slots */}
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
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
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-surface-subtle px-2.5 py-1"
                >
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{mealType.label}</span>
                  <span className={meal ? "font-mono text-xs font-medium tnum text-foreground" : "font-mono text-xs text-muted-foreground"}>
                    {meal ? meal.calories : "—"}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Log meal hint */}
          <div className="flex items-center gap-2 border-t border-border pt-1.5 text-xs text-muted-foreground">
            <Utensils className="h-3.5 w-3.5 shrink-0" />
            <span>Tap to log a meal</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
