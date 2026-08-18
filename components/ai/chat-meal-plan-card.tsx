"use client"

import { Check, Loader2, UtensilsCrossed } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { acceptAIMealPlan, type AIChatAction } from "@/lib/fitness/api"

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Sáng",
  lunch: "Trưa",
  dinner: "Tối",
  snack: "Phụ",
}

type MealPlanAction = Extract<AIChatAction, { type: "meal_plan_draft" }>

/**
 * Draft meal plan the assistant built during a chat turn. Nothing reaches the
 * food diary until the trainee confirms — accepting calls the same endpoint the
 * Meals page uses.
 */
function ChatMealPlanCard({
  action,
  accessToken,
}: {
  action: MealPlanAction
  accessToken: string
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const handleAccept = useCallback(async () => {
    setStatus("saving")
    setError(null)
    try {
      await acceptAIMealPlan(accessToken, action.generationId, action.date)
      setStatus("saved")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Không lưu được thực đơn.")
    }
  }, [accessToken, action.generationId, action.date])

  const { totals } = action

  return (
    <div className="mt-2 rounded-xl border bg-background p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UtensilsCrossed className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">Thực đơn ngày {action.date}</p>
          <p className="text-[11px] text-muted-foreground">
            {Math.round(totals.calories)} kcal · P {Math.round(totals.protein)}g · C{" "}
            {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g
          </p>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        {action.meals.map((meal, i) => (
          <div key={i}>
            <p className="text-[11px] font-medium text-muted-foreground">
              {MEAL_TYPE_LABELS[meal.type] ?? meal.type}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {meal.items.map((item, j) => (
                <li key={j} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{item.foodName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.quantityLabel ?? `${item.amountValue} ${item.amountUnit}`}
                  </span>
                </li>
              ))}
              {meal.items.length === 0 && (
                <li className="text-xs text-muted-foreground">Không có món</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {status === "saved" ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Check className="size-3.5" />
          Đã ghi vào nhật ký ăn uống
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

      {error && <p className="mt-2 text-[11px] text-destructive-text">{error}</p>}
    </div>
  )
}

export { ChatMealPlanCard }
