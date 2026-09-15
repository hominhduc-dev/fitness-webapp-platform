"use client"

import { useAcceptAIMealPlan, useGenerateAIMealPlan, useRegenerateAIMealPlanMeal } from "@/lib/queries/ai"

import { Bot, Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useState } from "react"

import { AIMessage } from "@/components/ai/ai-message"
import { buildMealPlanOverrides, MealPlanDraft, omitMealEdits, type MealPlanEdits } from "@/components/ai/meal-plan-draft"
import { useAuth } from "@/components/providers/auth-provider"
import { BottomSheet, BottomSheetBody, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppDietType } from "@/lib/auth/types"
import type { AIMealPlan } from "@/lib/fitness/api"
import type { MealType } from "@/lib/types"
import { cn } from "@/lib/utils"

const DAY_OPTIONS = [
  { value: 1, label: "1 ngày" },
  { value: 3, label: "3 ngày" },
  { value: 7, label: "7 ngày" },
] as const

const DIET_OPTIONS: ReadonlyArray<{ value: AppDietType | null; label: string }> = [
  { value: null, label: "Bình thường" },
  { value: "vegetarian", label: "Ăn chay" },
  { value: "pescatarian", label: "Không thịt" },
]

const BUDGET_OPTIONS = [
  { value: "low", label: "Tiết kiệm" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Không giới hạn" },
] as const

const COOKING_OPTIONS = [
  { value: "quick", label: "Nhanh (15-20p)" },
  { value: "normal", label: "Bình thường" },
] as const

function OptionGroup<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <section>
      <Label className="mb-2 block text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
              value === option.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function parseAllergies(value: string) {
  return [...new Set(value.split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean))].slice(0, 20)
}

function sameList(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function MealPlanGenerator({
  date,
  onAccepted,
  onClose,
}: {
  accessToken: string
  date: string
  onAccepted: () => void
  onClose: () => void
}) {
  const { profile, updateProfile } = useAuth()
  const { mutateAsync: generateAIMealPlan, isPending: isGenerating } = useGenerateAIMealPlan()
  const { mutateAsync: acceptAIMealPlan, isPending: isAccepting } = useAcceptAIMealPlan()
  const { mutateAsync: regenerateMeal } = useRegenerateAIMealPlanMeal()
  const [days, setDays] = useState<number>(1)
  const [allergiesText, setAllergiesText] = useState(() => (profile?.foodAllergies ?? []).join(", "))
  const [dietType, setDietType] = useState<AppDietType | null>(profile?.dietType ?? null)
  const [preferences, setPreferences] = useState("")
  const [budget, setBudget] = useState<string>("medium")
  const [cookingTime, setCookingTime] = useState<string>("normal")
  const [plan, setPlan] = useState<AIMealPlan | null>(null)
  const [edits, setEdits] = useState<MealPlanEdits>({})
  const [swappingKey, setSwappingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setError(null)
    setPlan(null)
    setEdits({})

    try {
      // Allergies and diet live on the profile because the server filters the catalog from there.
      const allergies = parseAllergies(allergiesText)
      if (!sameList(allergies, profile?.foodAllergies ?? []) || dietType !== (profile?.dietType ?? null)) {
        await updateProfile({ dietType, foodAllergies: allergies })
      }
      setPlan(await generateAIMealPlan([{ date, days, preferences: preferences || undefined, budget, cookingTime }]))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo thực đơn. Vui lòng thử lại.")
    }
  }

  const handleSwapMeal = async (dayDate: string, mealType: MealType) => {
    if (!plan) return
    setError(null)
    setSwappingKey(`${dayDate}|${mealType}`)
    try {
      const next = await regenerateMeal([{ generationId: plan.generationId, date: dayDate, mealType }])
      setPlan(next)
      setEdits((current) => omitMealEdits(current, dayDate, mealType))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được bữa này. Vui lòng thử lại.")
    } finally {
      setSwappingKey(null)
    }
  }

  const handleAccept = async () => {
    if (!plan) return
    setError(null)

    try {
      await acceptAIMealPlan([plan.generationId, plan.days[0]?.date ?? date, buildMealPlanOverrides(plan, edits)])
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thực đơn. Vui lòng thử lại.")
    }
  }

  return (
    <BottomSheet ariaLabel="AI Gợi Ý Thực Đơn" variant="flush" onClose={onClose}>
      <BottomSheetHeader className="items-center">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          <h2 className="text-base font-semibold">AI Gợi Ý Thực Đơn</h2>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted pointer-coarse:size-11">
          <X className="size-4" />
        </button>
      </BottomSheetHeader>

      <BottomSheetBody>
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
            {error}
          </div>
        )}

        {plan ? (
          <div className="space-y-4">
            <MealPlanDraft
              plan={plan}
              edits={edits}
              onEditsChange={setEdits}
              onSwapMeal={(dayDate, mealType) => void handleSwapMeal(dayDate, mealType)}
              swappingKey={swappingKey}
              disabled={isAccepting}
            />

            {plan.notes && <AIMessage content={plan.notes} className="text-xs text-muted-foreground" />}

            <p className="text-xs text-muted-foreground">
              Thực đơn được lưu dưới dạng dự kiến, chưa tính là đã ăn. Bấm &quot;Đã ăn&quot; ở trang Meals sau mỗi bữa.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setPlan(null)}
                disabled={isAccepting || swappingKey !== null}
              >
                <RefreshCw className="size-4" />
                Tạo lại
              </Button>
              <Button className="flex-1 gap-2" onClick={() => void handleAccept()} disabled={isAccepting || swappingKey !== null}>
                {isAccepting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Lưu thực đơn
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <OptionGroup label="Số ngày" options={DAY_OPTIONS} value={days as (typeof DAY_OPTIONS)[number]["value"]} onChange={setDays} />

            <section>
              <Label htmlFor="food-allergies" className="mb-2 block text-sm font-medium text-muted-foreground">
                Dị ứng thực phẩm
              </Label>
              <Input
                id="food-allergies"
                placeholder="VD: tôm, đậu phộng, sữa"
                value={allergiesText}
                onChange={(event) => setAllergiesText(event.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Lưu vào hồ sơ. Món có tên chứa các từ này bị loại khỏi thực đơn, nhưng vẫn nên tự kiểm tra thành phần.
              </p>
            </section>

            <OptionGroup label="Chế độ ăn" options={DIET_OPTIONS} value={dietType} onChange={setDietType} />

            <section>
              <Label htmlFor="preferences" className="mb-2 block text-sm font-medium text-muted-foreground">
                Sở thích khác
              </Label>
              <Input
                id="preferences"
                placeholder="VD: ít dầu mỡ, thích món nước..."
                value={preferences}
                onChange={(event) => setPreferences(event.target.value)}
              />
            </section>

            <OptionGroup label="Ngân sách" options={BUDGET_OPTIONS} value={budget} onChange={setBudget} />
            <OptionGroup label="Thời gian nấu" options={COOKING_OPTIONS} value={cookingTime} onChange={setCookingTime} />

            <Button className="w-full gap-2" size="lg" disabled={isGenerating} onClick={() => void handleGenerate()}>
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
      </BottomSheetBody>
    </BottomSheet>
  )
}

export { MealPlanGenerator }
