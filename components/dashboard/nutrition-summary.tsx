"use client"

import { Flame } from "lucide-react"
import Link from "next/link"
import type { DailyNutrition } from "@/lib/types"
import { useLocale } from "@/components/providers/locale-provider"

interface NutritionSummaryProps {
  nutrition: DailyNutrition
}

export function NutritionSummary({ nutrition }: NutritionSummaryProps) {
  const { messages } = useLocale()
  const percentage = Math.round((nutrition.totalCalories / nutrition.targetCalories) * 100)
  const remaining = nutrition.targetCalories - nutrition.totalCalories

  return (
    <Link href="/meals" className="block">
      <div className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{messages.dashboard.todaysNutrition}</h3>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Flame className="h-5 w-5 text-accent" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Calorie ring visualization */}
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90 transform">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-muted"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${percentage * 2.51} 251`}
                  className="text-primary transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{percentage}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">{messages.dashboard.consumed}</p>
                <p className="text-xl font-bold">
                  {nutrition.totalCalories} <span className="text-sm font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{messages.dashboard.remaining}</p>
                <p className="text-lg font-semibold text-primary">
                  {remaining} <span className="text-sm font-normal text-muted-foreground">kcal</span>
                </p>
              </div>
            </div>
          </div>

          {/* Meals summary */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { key: "breakfast", label: messages.dashboard.breakfast },
              { key: "lunch", label: messages.dashboard.lunch },
              { key: "dinner", label: messages.dashboard.dinner },
              { key: "snack", label: messages.dashboard.snack },
            ].map((mealType) => {
              const meal = nutrition.meals.find((m) => m.type === mealType.key)
              return (
                <div key={mealType.key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="capitalize text-muted-foreground">{mealType.label}</span>
                  <span className={meal ? "font-medium" : "text-muted-foreground"}>
                    {meal ? `${meal.calories}` : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Link>
  )
}
