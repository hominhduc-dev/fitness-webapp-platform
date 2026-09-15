"use client"

import { Check, Minus, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatMealAmount, stepMealAmount } from "@/lib/nutrition/meal-plan"
import type { Meal, MealType } from "@/lib/types"

type PlannedMealsListProps = {
  meals: Meal[]
  getMealLabel: (type: MealType) => string
  disabled?: boolean
  onChangeAmount?: (itemId: string, amountValue: number) => void
  onDeleteItem?: (itemId: string) => void
  /** Trainee only: moves one planned meal into the food diary. */
  onConsumeMeal?: (type: MealType) => void
}

/** Planned (not yet eaten) meals, editable by the trainee on /meals and by their coach. */
export function PlannedMealsList({ meals, getMealLabel, disabled, onChangeAmount, onDeleteItem, onConsumeMeal }: PlannedMealsListProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {meals.map((meal) => (
        <div key={meal.id ?? meal.type} className="rounded-md border border-primary/20 bg-background/70 px-3 py-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{getMealLabel(meal.type)}</div>
              <div className="text-muted-foreground tnum">
                {Math.round(meal.calories)} kcal · {meal.items?.length ?? 0} món
              </div>
            </div>
            {onConsumeMeal ? (
              <Button size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" disabled={disabled} onClick={() => onConsumeMeal(meal.type)}>
                <Check className="size-3.5" />
                Đã ăn
              </Button>
            ) : null}
          </div>

          {meal.coachNote ? <p className="mt-1.5 rounded bg-primary/10 px-2 py-1 text-primary">Coach: {meal.coachNote}</p> : null}

          {meal.items?.length ? (
            <ul className="mt-1.5 space-y-1">
              {meal.items.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {onChangeAmount ? (
                    <span className="flex shrink-0 items-center">
                      <button
                        type="button"
                        aria-label="Giảm khẩu phần"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        disabled={disabled}
                        onClick={() => onChangeAmount(item.id, stepMealAmount(item.amountValue, item.amountUnit, -1))}
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-14 text-center tnum">{formatMealAmount(item.amountValue, item.amountUnit)}</span>
                      <button
                        type="button"
                        aria-label="Tăng khẩu phần"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        disabled={disabled}
                        onClick={() => onChangeAmount(item.id, stepMealAmount(item.amountValue, item.amountUnit, 1))}
                      >
                        <Plus className="size-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="shrink-0 text-muted-foreground tnum">{formatMealAmount(item.amountValue, item.amountUnit)}</span>
                  )}
                  <span className="w-14 shrink-0 text-right text-muted-foreground tnum">{Math.round(item.calories)} kcal</span>
                  {onDeleteItem ? (
                    <button
                      type="button"
                      aria-label="Bỏ món"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      disabled={disabled}
                      onClick={() => onDeleteItem(item.id)}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}
