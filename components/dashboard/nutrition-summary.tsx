"use client"

import Link from "next/link"
import { Utensils } from "lucide-react"

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
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const arc = (percentage / 100) * circumference

  return (
    <Link href="/meals" className="block h-full">
      <div className="flex h-full flex-col rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-primary/25">
        <span className="label-micro mb-4 block">{messages.dashboard.todaysNutrition}</span>

        <div className="flex flex-1 flex-col justify-between gap-5">
          {/* Donut + calories */}
          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90">
                <circle
                  cx="48" cy="48" r={radius}
                  stroke="currentColor" strokeWidth="7" fill="transparent"
                  className="text-muted"
                />
                <circle
                  cx="48" cy="48" r={radius}
                  stroke="currentColor" strokeWidth="7" fill="transparent"
                  strokeDasharray={`${arc} ${circumference}`}
                  className="text-primary transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[1.1rem] font-semibold tnum text-foreground">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Numbers */}
            <div className="space-y-3">
              <div>
                <p className="label-micro mb-0.5">{messages.dashboard.consumed}</p>
                <p className="font-mono text-[1.5rem] font-semibold leading-none tnum text-foreground">
                  {nutrition.totalCalories.toLocaleString()}
                  <span className="ml-1 text-[13px] font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
              <div>
                <p className="label-micro mb-0.5">{messages.dashboard.remaining}</p>
                <p className="font-mono text-[1.25rem] font-semibold leading-none tnum text-primary">
                  {remaining.toLocaleString()}
                  <span className="ml-1 text-[13px] font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
            </div>
          </div>

          {/* Meal slots */}
          <div className="grid grid-cols-2 gap-2">
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
                  className="flex items-center justify-between rounded-[8px] border border-border bg-muted px-3 py-2"
                >
                  <span className="text-[12px] text-muted-foreground">{mealType.label}</span>
                  <span className={meal ? "font-mono text-[12px] font-medium tnum text-foreground" : "font-mono text-[12px] text-muted-foreground"}>
                    {meal ? meal.calories : "—"}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Log meal hint */}
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Utensils className="h-3.5 w-3.5 shrink-0" />
            <span>Tap to log a meal</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
