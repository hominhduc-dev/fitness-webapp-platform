"use client"

import { Bot, Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptAIMealPlan, generateAIMealPlan } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type MealPlanResult = {
  generationId: string
  meals: Array<{
    type: string
    suggestion: string
    items: Array<{
      foodId: string
      foodName: string
      amountValue: number
      amountUnit: string
      calories: number
      protein: number
      carbs: number
      fat: number
    }>
  }>
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  notes: string
}

const BUDGET_OPTIONS = [
  { value: "low", label: "Tiết kiệm" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Không giới hạn" },
] as const

const COOKING_OPTIONS = [
  { value: "quick", label: "Nhanh (15-20p)" },
  { value: "normal", label: "Bình thường" },
] as const

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Ăn vặt",
}

function MealPlanGenerator({
  accessToken,
  date,
  onAccepted,
  onClose,
}: {
  accessToken: string
  date: string
  onAccepted: () => void
  onClose: () => void
}) {
  const [preferences, setPreferences] = useState("")
  const [budget, setBudget] = useState("medium")
  const [cookingTime, setCookingTime] = useState("normal")
  const [result, setResult] = useState<MealPlanResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const data = await generateAIMealPlan(accessToken, {
        date,
        preferences: preferences || undefined,
        budget,
        cookingTime,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo thực đơn. Vui lòng thử lại.")
    } finally {
      setIsGenerating(false)
    }
  }, [accessToken, date, preferences, budget, cookingTime])

  const handleAccept = useCallback(async () => {
    if (!result) return
    setIsAccepting(true)
    setError(null)

    try {
      await acceptAIMealPlan(accessToken, result.generationId, date)
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thực đơn. Vui lòng thử lại.")
    } finally {
      setIsAccepting(false)
    }
  }, [accessToken, result, date, onAccepted])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-background sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <h2 className="text-base font-semibold">AI Gợi Ý Thực Đơn</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              {/* Totals */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Calo", value: result.totals.calories, unit: "kcal" },
                  { label: "Protein", value: result.totals.protein, unit: "g" },
                  { label: "Carbs", value: result.totals.carbs, unit: "g" },
                  { label: "Fat", value: result.totals.fat, unit: "g" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="rounded-lg bg-muted p-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-semibold">
                      {Math.round(value)} {unit}
                    </div>
                  </div>
                ))}
              </div>

              {/* Meals */}
              {result.meals.map((meal, i) => (
                <div key={i} className="rounded-xl border">
                  <div className="border-b px-4 py-2.5">
                    <div className="text-sm font-semibold">
                      {MEAL_TYPE_LABELS[meal.type] ?? meal.type}
                    </div>
                    <div className="text-xs text-muted-foreground">{meal.suggestion}</div>
                  </div>
                  <div className="divide-y">
                    {meal.items.map((item, j) => (
                      <div key={j} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span>{item.foodName}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.amountValue} {item.amountUnit} · {Math.round(item.calories)} kcal
                        </span>
                      </div>
                    ))}
                    {meal.items.length === 0 && (
                      <div className="px-4 py-2 text-sm text-muted-foreground">
                        Không có món (lỗi mapping)
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {result.notes && (
                <p className="text-xs text-muted-foreground">{result.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setResult(null)}
                  disabled={isAccepting}
                >
                  <RefreshCw className="size-4" />
                  Tạo lại
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Chấp nhận
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Preferences */}
              <section>
                <Label htmlFor="preferences" className="mb-2 block text-sm font-medium text-muted-foreground">
                  Sở thích / hạn chế
                </Label>
                <Input
                  id="preferences"
                  placeholder="VD: ăn chay, không hải sản, ít dầu mỡ..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                />
              </section>

              {/* Budget */}
              <section>
                <Label className="mb-2 block text-sm font-medium text-muted-foreground">Ngân sách</Label>
                <div className="flex gap-2">
                  {BUDGET_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBudget(value)}
                      className={cn(
                        "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                        budget === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Cooking time */}
              <section>
                <Label className="mb-2 block text-sm font-medium text-muted-foreground">Thời gian nấu</Label>
                <div className="flex gap-2">
                  {COOKING_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCookingTime(value)}
                      className={cn(
                        "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                        cookingTime === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Generate */}
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    AI đang tạo thực đơn...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Tạo thực đơn AI
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { MealPlanGenerator }
