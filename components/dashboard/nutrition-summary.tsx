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
  const percentage =
    nutrition.targetCalories > 0 ? Math.min(100, Math.round((nutrition.totalCalories / nutrition.targetCalories) * 100)) : 0
  const remaining = nutrition.targetCalories - nutrition.totalCalories

  return (
    <Link href="/meals" className="block">
      <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_28px_60px_-36px_rgba(15,23,42,0.24)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{messages.dashboard.todaysNutrition}</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{messages.dashboard.todaysNutrition}</h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
            <Flame className="h-5 w-5 text-accent" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-24 w-24 shrink-0 sm:mx-0">
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
                <span className="text-2xl font-black text-slate-950">{percentage}%</span>
              </div>
            </div>
            <div className="w-full flex-1 space-y-2">
              <div>
                <p className="text-sm text-slate-500">{messages.dashboard.consumed}</p>
                <p className="text-xl font-black text-slate-950">
                  {nutrition.totalCalories} <span className="text-sm font-normal text-slate-500">kcal</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{messages.dashboard.remaining}</p>
                <p className="text-lg font-bold text-primary">
                  {remaining} <span className="text-sm font-normal text-slate-500">kcal</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {[
              { key: "breakfast", label: messages.dashboard.breakfast },
              { key: "lunch", label: messages.dashboard.lunch },
              { key: "dinner", label: messages.dashboard.dinner },
              { key: "snack", label: messages.dashboard.snack },
            ].map((mealType) => {
              const meal = nutrition.meals.find((m) => m.type === mealType.key)
              return (
                <div key={mealType.key} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5">
                  <span className="capitalize text-slate-500">{mealType.label}</span>
                  <span className={meal ? "font-semibold text-slate-950" : "text-slate-400"}>
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
