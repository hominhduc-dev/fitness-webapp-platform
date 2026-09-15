"use client"

import { useAcceptAIMealPlan } from "@/lib/queries/ai"

import { Check, Loader2, UtensilsCrossed } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AIChatAction } from "@/lib/fitness/api"
import { AI_MEAL_TYPE_LABELS } from "@/lib/nutrition/meal-plan"

type MealPlanAction = Extract<AIChatAction, { type: "meal_plan_draft" }>

/**
 * Draft meal plan the assistant built during a chat turn. Accepting saves it as
 * a planned menu (same endpoint the Meals page uses); nothing counts as eaten
 * until the trainee marks each meal eaten on the Meals page.
 */
function ChatMealPlanCard({
  action,
}: {
  action: MealPlanAction
}) {
  const { mutateAsync: acceptAIMealPlan, isPending: acceptAIMealPlanPending } = useAcceptAIMealPlan()
  const [saved, setSaved] = useState(false)
  const status = acceptAIMealPlanPending ? "saving" : saved ? "saved" : "idle"
  const [error, setError] = useState<string | null>(null)
  const firstDay = action.days[0]

  const handleAccept = async () => {
    setError(null)
    try {
      await acceptAIMealPlan([action.generationId, action.date])
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thực đơn.")
    }
  }

  if (!firstDay) return null
  const { totals } = firstDay

  return (
    <div className="mt-2 rounded-xl border bg-background p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UtensilsCrossed className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            {action.days.length > 1 ? `Thực đơn ${action.days.length} ngày từ ${action.date}` : `Thực đơn ngày ${action.date}`}
          </p>
          <p className="text-micro text-muted-foreground">
            {Math.round(totals.calories)} kcal · P {Math.round(totals.protein)}g · C{" "}
            {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g
          </p>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        {firstDay.meals.map((meal) => (
          <div key={meal.type}>
            <p className="text-micro font-medium text-muted-foreground">{AI_MEAL_TYPE_LABELS[meal.type] ?? meal.type}</p>
            <ul className="mt-0.5 space-y-0.5">
              {meal.items.map((item, j) => (
                <li key={j} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{item.foodName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.quantityLabel ?? `${item.amountValue} ${item.amountUnit}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {action.days.length > 1 ? (
          <p className="text-micro text-muted-foreground">
            + {action.days.length - 1} ngày nữa · {action.shoppingList.length} món cần mua
          </p>
        ) : null}
      </div>

      {status === "saved" ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Check className="size-3.5" />
          Đã lưu thực đơn dự kiến — đánh dấu &quot;Đã ăn&quot; ở trang Meals khi ăn xong
        </div>
      ) : (
        <Button
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          disabled={status === "saving"}
          onClick={() => void handleAccept()}
        >
          {status === "saving" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            "Dùng thực đơn này"
          )}
        </Button>
      )}

      {error && <p className="mt-2 text-micro text-destructive-text">{error}</p>}
    </div>
  )
}

export { ChatMealPlanCard }
