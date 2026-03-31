"use client"

import { format } from "date-fns"
import {
  Clock3,
  Coffee,
  Cookie,
  PencilLine,
  Plus,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Meal } from "@/lib/types"

type MealTypeListProps = {
  isSubmitting?: boolean
  meals: Meal[]
  onAddMealType?: (type: Meal["type"]) => void
  onDeleteMeal?: (mealId: string) => void
  onEditMeal?: (meal: Meal) => void
}

const mealTypeMeta: Array<{
  icon: LucideIcon
  type: Meal["type"]
}> = [
  { icon: Coffee, type: "breakfast" },
  { icon: UtensilsCrossed, type: "lunch" },
  { icon: UtensilsCrossed, type: "dinner" },
  { icon: Cookie, type: "snack" },
]

export function MealTypeList({
  isSubmitting = false,
  meals,
  onAddMealType,
  onDeleteMeal,
  onEditMeal,
}: MealTypeListProps) {
  const { locale, messages } = useLocale()

  const formatMetric = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

  const labelByType: Record<Meal["type"], string> = {
    breakfast: messages.meals.breakfast,
    dinner: messages.meals.dinner,
    lunch: messages.meals.lunch,
    snack: messages.meals.snack,
  }

  return (
    <div className="space-y-4">
      {mealTypeMeta.map((section) => {
        const mealsOfType = meals
          .filter((meal) => meal.type === section.type)
          .sort((left, right) => left.time.getTime() - right.time.getTime())
        const totalCalories = mealsOfType.reduce((sum, meal) => sum + meal.calories, 0)
        const subtitle =
          mealsOfType.length === 0 ? messages.meals.notLoggedYet : messages.meals.loggedMeals(mealsOfType.length, Math.round(totalCalories))

        return (
          <section
            key={section.type}
            className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,#fbfcff_0%,#ffffff_100%)] p-3 shadow-[0_20px_40px_-32px_rgba(37,99,235,0.35)]"
          >
            <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">{labelByType[section.type]}</h3>
                  <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                </div>
              </div>

              <Button
                type="button"
                size="icon-sm"
                className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgba(19,73,236,0.7)] hover:bg-primary/90"
                disabled={isSubmitting}
                onClick={() => onAddMealType?.(section.type)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {mealsOfType.length > 0 ? (
              <div className="mt-3 space-y-2">
                {mealsOfType.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex flex-col gap-3 rounded-[20px] border border-primary/10 bg-[#f7faff] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{meal.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {format(meal.time, locale === "en" ? "h:mm a" : "HH:mm")}
                        </span>
                        {meal.weightGrams ? <span>{`${formatMetric(meal.weightGrams)}g`}</span> : null}
                        {meal.protein || meal.carbs || meal.fat ? (
                          <span>{`${formatMetric(meal.protein || 0)}P / ${formatMetric(meal.carbs || 0)}C / ${formatMetric(meal.fat || 0)}F`}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span className="text-sm font-semibold text-foreground">{Math.round(meal.calories)} kcal</span>
                      <div className="flex items-center gap-1">
                        {onEditMeal ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            disabled={isSubmitting}
                            onClick={() => onEditMeal(meal)}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {onDeleteMeal ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                              "rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                              isSubmitting && "pointer-events-none",
                            )}
                            disabled={isSubmitting}
                            onClick={() => onDeleteMeal(meal.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
