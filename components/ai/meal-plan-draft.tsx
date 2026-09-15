"use client"

import { ClipboardList, Copy, Loader2, Minus, Plus, RefreshCw, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AIMealPlan, AIMealPlanDay, AIMealPlanOverride } from "@/lib/fitness/api"
import { AI_MEAL_TYPE_LABELS, formatMealAmount, scaleMacros, stepMealAmount, sumMacros } from "@/lib/nutrition/meal-plan"
import type { MealType } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Edited amount per draft item, keyed by `date|mealType|index`; `null` removes the item. */
export type MealPlanEdits = Record<string, number | null>

function itemKey(date: string, type: MealType, index: number) {
  return `${date}|${type}|${index}`
}

export function omitMealEdits(edits: MealPlanEdits, date: string, type: MealType): MealPlanEdits {
  const prefix = `${date}|${type}|`
  return Object.fromEntries(Object.entries(edits).filter(([key]) => !key.startsWith(prefix)))
}

/** Undefined when nothing was edited, so the server still checks the untouched draft against the targets. */
export function buildMealPlanOverrides(plan: AIMealPlan, edits: MealPlanEdits): AIMealPlanOverride[] | undefined {
  if (Object.keys(edits).length === 0) return undefined
  return plan.days.map((day) => ({
    date: day.date,
    meals: day.meals.map((meal) => ({
      type: meal.type,
      items: meal.items.flatMap((item, index) => {
        const edited = edits[itemKey(day.date, meal.type, index)]
        return edited === null ? [] : [{ foodId: item.foodId, amountValue: edited ?? item.amountValue, amountUnit: item.amountUnit }]
      }),
    })),
  }))
}

function editedDayTotals(day: AIMealPlanDay, edits: MealPlanEdits) {
  return sumMacros(
    day.meals.flatMap((meal) =>
      meal.items.flatMap((item, index) => {
        const edited = edits[itemKey(day.date, meal.type, index)]
        if (edited === null) return []
        return [edited === undefined ? item : scaleMacros(item, edited)]
      }),
    ),
  )
}

function formatDayLabel(date: string) {
  const [, month, day] = date.split("-")
  return `${day}/${month}`
}

type MealPlanDraftProps = {
  plan: AIMealPlan
  edits: MealPlanEdits
  onEditsChange: (edits: MealPlanEdits) => void
  onSwapMeal: (date: string, type: MealType) => void
  /** `date|mealType` of the meal being regenerated. */
  swappingKey: string | null
  disabled?: boolean
}

export function MealPlanDraft({ plan, edits, onEditsChange, onSwapMeal, swappingKey, disabled }: MealPlanDraftProps) {
  const [activeDate, setActiveDate] = useState(plan.days[0]?.date)
  const [view, setView] = useState<"menu" | "shopping">("menu")
  const [copied, setCopied] = useState(false)
  const day = plan.days.find((candidate) => candidate.date === activeDate) ?? plan.days[0]
  if (!day) return null

  const totals = editedDayTotals(day, edits)
  const setItem = (key: string, value: number | null) => onEditsChange({ ...edits, [key]: value })

  const copyShoppingList = async () => {
    try {
      await navigator.clipboard.writeText(plan.shoppingList.map((item) => `- ${item.foodName}: ${item.quantityLabel}`).join("\n"))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(["menu", "shopping"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={cn("flex-1 rounded-md py-1.5 font-medium transition-colors", view === option ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {option === "menu" ? "Thực đơn" : `Đi chợ (${plan.shoppingList.length})`}
          </button>
        ))}
      </div>

      {view === "shopping" ? (
        <div className="rounded-xl border">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4" />
              Danh sách đi chợ · {plan.days.length} ngày
            </div>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void copyShoppingList()}>
              <Copy className="size-3.5" />
              {copied ? "Đã chép" : "Sao chép"}
            </Button>
          </div>
          <ul className="divide-y">
            {plan.shoppingList.map((item) => (
              <li key={`${item.foodId}-${item.amountUnit}`} className="flex justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">{item.foodName}</span>
                <span className="shrink-0 text-xs text-muted-foreground tnum">{item.quantityLabel}</span>
              </li>
            ))}
          </ul>
          {Object.keys(edits).length > 0 ? (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">Số lượng tính theo bản nháp gốc, chưa gồm phần bạn vừa chỉnh.</p>
          ) : null}
        </div>
      ) : (
        <>
          {plan.days.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {plan.days.map((candidate) => (
                <button
                  key={candidate.date}
                  type="button"
                  onClick={() => setActiveDate(candidate.date)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium tnum",
                    candidate.date === day.date ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {formatDayLabel(candidate.date)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Calo", value: totals.calories, target: day.targets.calories, unit: "" },
              { label: "Protein", value: totals.protein, target: day.targets.protein, unit: "g" },
              { label: "Carbs", value: totals.carbs, target: day.targets.carbs, unit: "g" },
              { label: "Fat", value: totals.fat, target: day.targets.fat, unit: "g" },
            ].map(({ label, value, target, unit }) => (
              <div key={label} className="rounded-lg bg-muted p-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold tnum">
                  {Math.round(value)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{Math.round(target)}
                    {unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {day.consumed.calories > 0 ? (
            <p className="text-xs text-muted-foreground">Ngày này đã ăn {Math.round(day.consumed.calories)} kcal nên thực đơn chỉ lên phần còn lại.</p>
          ) : null}

          {day.meals.map((meal) => {
            const isSwapping = swappingKey === `${day.date}|${meal.type}`
            return (
              <div key={meal.type} className="rounded-xl border">
                <div className="flex items-start justify-between gap-2 border-b px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{AI_MEAL_TYPE_LABELS[meal.type]}</div>
                    <div className="text-xs text-muted-foreground">{meal.suggestion}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={disabled || swappingKey !== null}
                    onClick={() => onSwapMeal(day.date, meal.type)}
                  >
                    {isSwapping ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Đổi bữa
                  </Button>
                </div>
                <div className={cn("divide-y", isSwapping && "opacity-50")}>
                  {meal.items.map((item, index) => {
                    const key = itemKey(day.date, meal.type, index)
                    const edited = edits[key]
                    if (edited === null) return null
                    const amount = edited ?? item.amountValue
                    const calories = edited === undefined ? item.calories : scaleMacros(item, amount).calories
                    return (
                      <div key={key} className="flex items-center gap-1.5 px-4 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{item.foodName}</span>
                        <span className="flex shrink-0 items-center">
                          <button
                            type="button"
                            aria-label="Giảm khẩu phần"
                            disabled={disabled}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                            onClick={() => setItem(key, stepMealAmount(amount, item.amountUnit, -1))}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-16 text-center text-xs tnum">
                            {edited === undefined && item.quantityLabel ? item.quantityLabel : formatMealAmount(amount, item.amountUnit)}
                          </span>
                          <button
                            type="button"
                            aria-label="Tăng khẩu phần"
                            disabled={disabled}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                            onClick={() => setItem(key, stepMealAmount(amount, item.amountUnit, 1))}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tnum">{Math.round(calories)} kcal</span>
                        <button
                          type="button"
                          aria-label="Bỏ món"
                          disabled={disabled}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                          onClick={() => setItem(key, null)}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
