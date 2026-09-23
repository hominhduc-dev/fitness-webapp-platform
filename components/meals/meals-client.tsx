"use client"

import { addDays, format } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import {
  BadgeCheck,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
  type LucideIcon,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { MealPlanGenerator } from "@/components/ai/meal-plan-generator"
import { MealsLoadingState } from "@/components/meals/meals-loading-state"
import { NutritionDetails } from "@/components/meals/nutrition-details"
import { NutritionInsightButton } from "@/components/meals/nutrition-insight"
import { WeeklyCalendarStrip } from "@/components/meals/weekly-calendar-strip"
import { PlannedMealsList } from "@/components/meals/planned-meals-list"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { createCustomFood, fetchNutritionDay, FoodNutritionLookup, LastFoodPortions } from "@/lib/fitness/api"
import { foodDisplayName, foodMatchesSearch, servingLabelFor, type FoodNameLanguage } from "@/lib/nutrition/food-names"
import { useAddMealItem, useConsumePlannedMeals, useCreateCustomFood, useDeleteMealItem, useFoodNutritionLookup, useFoods, useNutritionDay, useUpdateCustomFood, useUpdateMealItemAmount } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"
import type { FoodCategory, Meal, MealType, NutritionFood } from "@/lib/types"

type NutritionDay = Awaited<ReturnType<typeof fetchNutritionDay>>
type NutritionTargets = NutritionDay["targets"]
type NutritionTotals = NutritionDay["totals"]

export type MealsClientInitialData = {
  foods: NutritionFood[]
  nutritionDay: NutritionDay
  selectedDateKey: string
}

const FOOD_CATEGORIES: Array<{ id: FoodCategory | "all"; labelKey: keyof ReturnType<typeof useLocale>["messages"]["meals"] }> = [
  { id: "all", labelKey: "allFoods" },
  { id: "staple", labelKey: "categoryStaple" },
  { id: "protein", labelKey: "categoryProtein" },
  { id: "veg", labelKey: "categoryVeg" },
  { id: "fruit", labelKey: "categoryFruit" },
  { id: "dish", labelKey: "categoryDish" },
  { id: "drink", labelKey: "categoryDrink" },
  { id: "other", labelKey: "categoryOther" },
]

function subscribeAfterHydration(onStoreChange: () => void) {
  const frame = window.requestAnimationFrame(onStoreChange)
  return () => window.cancelAnimationFrame(frame)
}

function useHasHydrated() {
  return useSyncExternalStore(subscribeAfterHydration, () => true, () => false)
}

const MEAL_META: Array<{ icon: LucideIcon; type: MealType }> = [
  { icon: Sunrise, type: "breakfast" },
  { icon: Sun, type: "lunch" },
  { icon: Sunset, type: "dinner" },
  { icon: Cookie, type: "snack" },
]

const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2_000,
  carbs: 250,
  fat: 67,
  protein: 150,
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** The meal a food picked right now most likely belongs to. */
function mealTypeForNow(now = new Date()): MealType {
  const hour = now.getHours()
  if (hour < 10) return "breakfast"
  if (hour < 15) return "lunch"
  if (hour < 21) return "dinner"
  return "snack"
}

function formatMetric(value?: number, digits = 1) {
  const safeValue = value ?? 0
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(digits)
}

const MACRO_RING_COLORS = {
  carbs: "text-success-text",
  fat: "text-warning-text",
  protein: "text-primary",
} as const

function CalorieRing({ consumed, target, totals }: { consumed: number; target: number; totals: Pick<NutritionTotals, "carbs" | "fat" | "protein"> }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const macroSegments = [
    { className: MACRO_RING_COLORS.protein, key: "protein", value: totals.protein * 4 },
    { className: MACRO_RING_COLORS.carbs, key: "carbs", value: totals.carbs * 4 },
    { className: MACRO_RING_COLORS.fat, key: "fat", value: totals.fat * 9 },
  ].filter((segment) => segment.value > 0)
  let offset = 0

  return (
    <div className="relative size-24 shrink-0 md:size-32">
      <svg className="size-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        {macroSegments.map((segment) => {
          const segmentLength = target > 0 ? circumference * Math.min(segment.value / target, 1) : 0
          const dashOffset = -offset
          offset += segmentLength

          return (
            <circle
              key={segment.key}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="10"
              className={cn("transition-all duration-300", segment.className)}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-semibold leading-none text-foreground tnum md:text-3xl">
          {Math.round(consumed).toLocaleString()}
        </span>
        <span className="mt-0.5 font-mono text-micro text-muted-foreground tnum md:mt-1">
          / {Math.round(target).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function MacroBar({
  colorClassName = "bg-ink-600",
  consumed,
  label,
  target,
  warnOverTarget = true,
}: {
  colorClassName?: string
  consumed: number
  label: string
  target: number
  /** Off for nutrients where more is fine (fiber). */
  warnOverTarget?: boolean
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const overTarget = warnOverTarget && consumed > target

  return (
    <div className="min-w-0">
      <div className="mb-1.5 min-w-0">
        <span className="block truncate text-xs text-muted-foreground md:text-sm">{label}</span>
        <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground tnum">
          <span className="font-semibold text-foreground">{formatMetric(consumed)}</span>/{target}g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", overTarget ? "bg-warning" : colorClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MacroSplit({
  labels,
  totals,
}: {
  labels: { carbs: string; fat: string; protein: string; title: string }
  totals: NutritionTotals
}) {
  const proteinCals = totals.protein * 4
  const carbCals = totals.carbs * 4
  const fatCals = totals.fat * 9
  const totalMacroCals = proteinCals + carbCals + fatCals || 1
  const rows = [
    { color: "bg-primary", label: labels.protein, value: proteinCals },
    { color: "bg-ink-400", label: labels.carbs, value: carbCals },
    { color: "bg-ink-800", label: labels.fat, value: fatCals },
  ]

  return (
    <section className="rounded-lg border border-border bg-card p-[18px]">
      <p className="label-micro mb-3.5">{labels.title}</p>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const pct = Math.round((row.value / totalMacroCals) * 100)
          return (
            <div key={row.label} className="grid grid-cols-[60px_minmax(0,1fr)_38px] items-center gap-2.5">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-right font-mono text-xs text-muted-foreground tnum">{pct}%</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MealSection({
  deleteLabel,
  highlight,
  isSubmitting,
  label,
  meal,
  meta,
  onAdd,
  onDeleteItem,
}: {
  deleteLabel: string
  highlight: boolean
  isSubmitting: boolean
  label: string
  meal: Meal
  meta: (typeof MEAL_META)[number]
  onAdd: (type: MealType) => void
  onDeleteItem: (itemId: string) => void
}) {
  const Icon = meta.icon
  const items = meal.items ?? []

  return (
    <section
      id={`meal-section-${meta.type}`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card transition-[box-shadow,border-color,background-color] duration-500",
        highlight && "border-primary bg-primary/5 ring-2 ring-primary/70 ring-offset-2 ring-offset-background shadow-[0_0_32px_-10px_var(--primary)]",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-4 py-3.5", items.length > 0 && "border-b border-border")}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-[15px] w-[15px]" />
        </div>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{label}</h3>
        <span className="font-mono text-sm text-muted-foreground tnum">{Math.round(meal.calories)} kcal</span>
        <Button
          className="h-[30px] w-[30px] shrink-0 rounded-md border-primary/60 text-primary"
          disabled={isSubmitting}
          size="icon"
          type="button"
          variant="outline"
          onClick={() => onAdd(meta.type)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2.5 border-b border-ink-50 px-4 py-2.5 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">
              {item.name}
              {item.amountLabel ? <span className="text-muted-foreground"> {item.amountLabel}</span> : null}
            </p>
            <p className="mt-0.5 font-mono text-micro text-muted-foreground tnum">
              P{formatMetric(item.protein, 0)} · C{formatMetric(item.carbs, 0)} · F{formatMetric(item.fat, 0)}
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground tnum">{Math.round(item.calories)}</span>
          <button
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded text-ink-200 transition-colors hover:text-destructive-text pointer-coarse:size-11"
            disabled={isSubmitting}
            title={deleteLabel}
            type="button"
            onClick={() => onDeleteItem(item.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </section>
  )
}

type CreateFoodDraft = {
  name: string
  nameEn?: string
  category?: FoodCategory
  servingLabel?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  /** Set when the numbers came from an AI lookup rather than the trainee. */
  aiEstimate?: { confidence: "high" | "medium" | "low"; note: string }
  /** An admin's reason for sending the food back, shown while editing it. */
  reviewNote?: string
}

function CreateFoodForm({
  draft,
  editing = false,
  getCategoryLabel,
  labels,
  onCancel,
  onSave,
  saving,
}: {
  draft?: CreateFoodDraft | null
  /** Correcting an existing food rather than creating one. */
  editing?: boolean
  getCategoryLabel: (category: FoodCategory | "all") => string
  labels: {
    editFoodResubmit: string
    editFoodTitle: string
    reviewNoteFromAdmin: string
    saveChanges: string
    aiConfidence: Record<"high" | "medium" | "low", string>
    aiEstimateReview: string
    aiEstimateTitle: string
    calories: string
    cancel: string
    createFoodTitle: string
    fat: string
    foodGroup: string
    foodLibrary: string
    foodName: string
    foodNameEn: string
    foodNameEnPlaceholder: string
    foodNamePlaceholder: string
    protein: string
    saveFood: string
    serving: string
    servingHint: string
    servingPlaceholder: string
    carbs: string
  }
  onCancel: () => void
  onSave: (input: {
    calories: number
    carbs?: number
    category: FoodCategory
    fat?: number
    name: string
    nameEn?: string
    protein?: number
    servingLabel: string
  }) => Promise<void> | void
  saving: boolean
}) {
  const [name, setName] = useState(draft?.name ?? "")
  const [nameEn, setNameEn] = useState(draft?.nameEn ?? "")
  const [category, setCategory] = useState<FoodCategory>(draft?.category ?? "dish")
  const [servingLabel, setServingLabel] = useState(draft?.servingLabel ?? "100 g")
  const [calories, setCalories] = useState(draft?.calories != null ? String(draft.calories) : "")
  const [protein, setProtein] = useState(draft?.protein != null ? String(draft.protein) : "")
  const [carbs, setCarbs] = useState(draft?.carbs != null ? String(draft.carbs) : "")
  const [fat, setFat] = useState(draft?.fat != null ? String(draft.fat) : "")
  const aiEstimate = draft?.aiEstimate
  const canSave = name.trim() && servingLabel.trim() && Number(calories) > 0

  return (
    <>
      <BottomSheetHeader>
        <div>
          <p className="label-micro mb-1.5">{labels.foodLibrary}</p>
          <h2 className="text-lg font-semibold text-foreground">{editing ? labels.editFoodTitle : labels.createFoodTitle}</h2>
        </div>
        <button className="rounded p-1 text-muted-foreground hover:bg-muted" type="button" onClick={onCancel}>
          <X className="h-4 w-4" />
        </button>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-4">
        {editing && draft?.reviewNote ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-3">
            <p className="label-micro mb-1 text-destructive-text">{labels.reviewNoteFromAdmin}</p>
            <p className="text-sm text-foreground">{draft.reviewNote}</p>
          </div>
        ) : null}
        {editing ? <p className="text-xs text-muted-foreground">{labels.editFoodResubmit}</p> : null}
        {aiEstimate ? (
          <div className="rounded-xl border border-primary/25 bg-primary-soft/40 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              <p className="text-sm font-semibold text-foreground">{labels.aiEstimateTitle}</p>
              <Badge variant={aiEstimate.confidence === "low" ? "destructive" : "secondary"} className="text-micro">
                {labels.aiConfidence[aiEstimate.confidence]}
              </Badge>
            </div>
            {aiEstimate.note ? <p className="mt-1.5 text-xs text-muted-foreground">{aiEstimate.note}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">{labels.aiEstimateReview}</p>
          </div>
        ) : null}
        <div>
          <p className="label-micro mb-1.5">{labels.foodName}</p>
          <Input value={name} placeholder={labels.foodNamePlaceholder} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <p className="label-micro mb-1.5">{labels.foodNameEn}</p>
          <Input value={nameEn} placeholder={labels.foodNameEnPlaceholder} onChange={(event) => setNameEn(event.target.value)} />
        </div>
        <div>
          <p className="label-micro mb-2">{labels.foodGroup}</p>
          <div className="flex flex-wrap gap-1.5">
            {FOOD_CATEGORIES.filter((categoryOption) => categoryOption.id !== "all").map((categoryOption) => (
              <button
                key={categoryOption.id}
                data-active={category === categoryOption.id}
                className={cn(
                  "meal-food-sheet__category rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                  category === categoryOption.id
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_18px_-10px_var(--primary)]"
                    : "border-border/80 bg-background/55 text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground",
                )}
                type="button"
                onClick={() => setCategory(categoryOption.id as FoodCategory)}
              >
                {getCategoryLabel(categoryOption.id)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label-micro mb-1.5">{labels.serving}</p>
          <Input value={servingLabel} placeholder={labels.servingPlaceholder} onChange={(event) => setServingLabel(event.target.value)} />
          <p className="mt-1.5 text-micro text-muted-foreground">{labels.servingHint}</p>
        </div>
        <div>
          <p className="label-micro mb-1.5">{labels.calories}</p>
          <Input value={calories} inputMode="decimal" placeholder="0" type="number" onChange={(event) => setCalories(event.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            [labels.protein, protein, setProtein],
            [labels.carbs, carbs, setCarbs],
            [labels.fat, fat, setFat],
          ].map(([label, value, setter]) => (
            <div key={label as string}>
              <p className="label-micro mb-1.5">{label as string}</p>
              <Input
                value={value as string}
                inputMode="decimal"
                placeholder="0"
                type="number"
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
              />
            </div>
          ))}
        </div>
      </BottomSheetBody>

      <BottomSheetFooter className="justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          disabled={!canSave || saving}
          type="button"
          onClick={() => {
            void onSave({
              calories: Number(calories),
              carbs: carbs ? Number(carbs) : undefined,
              category,
              fat: fat ? Number(fat) : undefined,
              name: name.trim(),
              nameEn: nameEn.trim() || undefined,
              protein: protein ? Number(protein) : undefined,
              servingLabel: servingLabel.trim(),
            })
          }}
        >
          <Check className="h-4 w-4" />
          {editing ? labels.saveChanges : labels.saveFood}
        </Button>
      </BottomSheetFooter>
    </>
  )
}

type FoodTab = "all" | "recent" | "mine"
const FOOD_TABS: FoodTab[] = ["all", "recent", "mine"]

const FOOD_NAME_LANGUAGE_KEY = "meals.foodNameLanguage"

/** The sheet's name language is a per-device preference; storage can be unavailable. */
function readFoodNameLanguage(): FoodNameLanguage | null {
  try {
    const value = window.localStorage.getItem(FOOD_NAME_LANGUAGE_KEY)
    return value === "vi" || value === "en" ? value : null
  } catch {
    return null
  }
}

function writeFoodNameLanguage(language: FoodNameLanguage) {
  try {
    window.localStorage.setItem(FOOD_NAME_LANGUAGE_KEY, language)
  } catch {
    // Private mode or blocked storage: the choice just lasts for this sheet.
  }
}

/** A remembered portion only counts if this food can still be logged in that unit. */
function usablePortion(food: NutritionFood, portion: LastFoodPortions[string] | undefined) {
  if (!portion || portion.amountValue <= 0) return null
  const unit = portion.amountUnit
  const fits =
    unit === "serving" ||
    (unit === "g" && (food.servingUnit === "g" || (food.servingGrams ?? 0) > 0)) ||
    (unit === "ml" && food.servingUnit === "ml")
  return fits ? { amountUnit: unit as "g" | "ml" | "serving", amountValue: portion.amountValue } : null
}

function AddFoodModal({
  foods,
  getCategoryLabel,
  getMealLabel,
  labels,
  mealType,
  onAdd,
  onClose,
  onCreateFood,
  onLookupFood,
  onMealTypeChange,
  onUpdateFood,
  defaultNameLanguage,
  initialFoodId,
  lastPortions,
  recentFoods,
  submitting,
}: {
  defaultNameLanguage: FoodNameLanguage
  foods: NutritionFood[]
  /** Opens with this food already picked, e.g. from an insight suggestion. */
  initialFoodId?: string | null
  getCategoryLabel: (category: FoodCategory | "all") => string
  getMealLabel: (mealType: MealType) => string
  labels: {
    addFoodItem: string
    addToMeal: (meal: string) => string
    aiConfidence: Record<"high" | "medium" | "low", string>
    aiEstimateReview: string
    aiEstimateTitle: string
    aiLookupError: string
    aiLookupFood: (query: string) => string
    aiLookupHint: string
    aiLookupLoading: string
    aiLookupNotFound: string
    calories: string
    cancel: string
    carbs: string
    createFoodTitle: string
    createNewFood: string
    fat: string
    foodGroup: string
    foodLibrary: string
    foodName: string
    foodNameEn: string
    foodNameEnPlaceholder: string
    foodNameLanguage: string
    foodNamePlaceholder: string
    lastPortion: (amount: string) => string
    logFood: string
    logFoodTabs: Record<FoodTab, string>
    logFoodAllFoods: string
    logFoodResults: string
    logFoodQuickAdd: (name: string) => string
    logFoodChooseMeal: string
    logFoodAiLookup: string
    logFoodAiNeedsQuery: string
    logFoodCreate: string
    logFoodVerified: string
    logFoodEmptyTab: string
    editFood: (name: string) => string
    editFoodResubmit: string
    editFoodTitle: string
    reviewNoteFromAdmin: string
    saveChanges: string
    noFoodsFound: string
    pendingReview: string
    protein: string
    rejectedReview: string
    recentFoods: string
    recentFoodsHint: string
    saveFood: string
    searchFoodPlaceholder: string
    serving: string
    servingHint: string
    servingPlaceholder: string
  }
  mealType: MealType
  onAdd: (input: { amountUnit: "g" | "ml" | "serving"; amountValue: number; food: NutritionFood }) => void
  onClose: () => void
  onCreateFood: (input: Parameters<typeof createCustomFood>[1]) => Promise<NutritionFood | null>
  onLookupFood: (query: string) => Promise<FoodNutritionLookup>
  onMealTypeChange: (mealType: MealType) => void
  onUpdateFood: (foodId: string, input: Parameters<typeof createCustomFood>[1]) => Promise<NutritionFood | null>
  lastPortions: LastFoodPortions
  recentFoods: NutritionFood[]
  submitting: boolean
}) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<FoodTab>("all")
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedFood, setSelectedFood] = useState<NutritionFood | null>(null)
  const [amountValue, setAmountValue] = useState(1)
  const [amountUnit, setAmountUnit] = useState<"g" | "ml" | "serving">("serving")
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<CreateFoodDraft | null>(null)
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [nameLanguage, setNameLanguage] = useState<FoodNameLanguage>(() => readFoodNameLanguage() ?? defaultNameLanguage)
  const tabFoods = tab === "recent" ? recentFoods : tab === "mine" ? foods.filter((food) => food.source === "user") : foods
  const filteredFoods = tabFoods.filter((food) => foodMatchesSearch(food, query))
  const nameOf = (food: NutritionFood) => foodDisplayName(food, nameLanguage)
  const servingOf = (food: NutritionFood) => servingLabelFor(food.servingLabel, nameLanguage)
  const lastPortion = selectedFood ? usablePortion(selectedFood, lastPortions[selectedFood.id]) : null

  const openedWith = useRef<string | null>(null)
  useEffect(() => {
    if (!initialFoodId || openedWith.current === initialFoodId) return
    const food = foods.find((candidate) => candidate.id === initialFoodId)
    if (!food) return
    openedWith.current = initialFoodId
    pickFood(food)
    // pickFood only reads props that are stable while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foods, initialFoodId])

  function changeNameLanguage(language: FoodNameLanguage) {
    setNameLanguage(language)
    writeFoodNameLanguage(language)
  }
  const trimmedQuery = query.trim()
  const canLookup = filteredFoods.length === 0 && trimmedQuery.length >= 2

  function startCreating(nextDraft: CreateFoodDraft | null) {
    setEditingFoodId(null)
    setDraft(nextDraft)
    setCreating(true)
  }

  function startEditing(food: NutritionFood) {
    setEditingFoodId(food.id)
    setDraft({
      calories: food.calories,
      carbs: food.carbs,
      category: food.category,
      fat: food.fat,
      name: food.name,
      nameEn: food.nameEn,
      protein: food.protein,
      reviewNote: food.reviewStatus === "rejected" ? food.reviewNote : undefined,
      servingLabel: food.servingLabel,
    })
    setCreating(true)
  }

  async function handleUpdateFood(input: Parameters<typeof createCustomFood>[1]) {
    if (!editingFoodId) return
    setCreating(false)
    const food = await onUpdateFood(editingFoodId, input)
    setEditingFoodId(null)
    if (food) pickFood(food)
  }

  async function lookupFood() {
    setLookingUp(true)
    setLookupMessage(null)
    try {
      const result = await onLookupFood(trimmedQuery)
      if (!result.found) {
        setLookupMessage(result.note || labels.aiLookupNotFound)
        return
      }
      startCreating({
        aiEstimate: { confidence: result.confidence, note: result.note },
        calories: result.calories,
        carbs: result.carbs,
        category: result.category,
        fat: result.fat,
        name: result.name,
        nameEn: result.nameEn,
        protein: result.protein,
        servingLabel: result.servingLabel,
      })
    } catch (lookupError) {
      setLookupMessage(lookupError instanceof Error ? lookupError.message : labels.aiLookupError)
    } finally {
      setLookingUp(false)
    }
  }

  function startingPortion(food: NutritionFood): { amountUnit: "g" | "ml" | "serving"; amountValue: number } {
    // What the trainee ate last time is the best guess for this time.
    const previous = usablePortion(food, lastPortions[food.id])
    if (previous) return previous

    // Anything with a known serving weight is logged in grams, so a dish sold
    // by the bowl is still something the trainee can weigh. Drinks keep ml.
    const unit =
      food.servingUnit === "g" || food.servingUnit === "ml"
        ? food.servingUnit
        : food.servingGrams && food.servingGrams > 0
          ? "g"
          : "serving"
    return {
      amountUnit: unit,
      amountValue: unit === "serving" ? 1 : unit === "g" && food.servingUnit !== "g" ? (food.servingGrams ?? 1) : food.servingAmount,
    }
  }

  function pickFood(food: NutritionFood) {
    const portion = startingPortion(food)
    setSelectedFood(food)
    setAmountUnit(portion.amountUnit)
    setAmountValue(portion.amountValue)
  }

  /** The row's + button: log the starting portion straight away. */
  function quickAdd(food: NutritionFood) {
    onAdd({ ...startingPortion(food), food })
  }

  function runAiLookup() {
    if (trimmedQuery.length >= 2) {
      void lookupFood()
      return
    }
    setLookupMessage(labels.logFoodAiNeedsQuery)
    searchRef.current?.focus()
  }

  async function handleCreateFood(input: Parameters<typeof createCustomFood>[1]) {
    setCreating(false)
    setQuery("")
    setTab("all")

    const food = await onCreateFood(input)

    if (food) {
      pickFood(food)
    }
  }

  // Mirrors `calculateItemNutrition` on the server so the preview matches what
  // gets saved.
  const multiplier =
    selectedFood && amountUnit === "g" && selectedFood.servingGrams && selectedFood.servingGrams > 0
      ? amountValue / selectedFood.servingGrams
      : selectedFood && amountUnit !== "serving" && selectedFood.servingUnit === amountUnit && selectedFood.servingAmount > 0
        ? amountValue / selectedFood.servingAmount
        : amountValue

  return (
    <BottomSheet
      ariaLabel={labels.logFood}
      className="meal-food-sheet glass-surface h-full max-h-[min(780px,100%)] border-border/80 bg-card shadow-[var(--glass-shadow)] sm:h-auto sm:max-w-[540px]"
      overlayClassName="z-[70]"
      onClose={onClose}
    >
      {creating ? (
        <CreateFoodForm
          draft={draft}
          editing={editingFoodId != null}
          getCategoryLabel={getCategoryLabel}
          labels={labels}
          saving={submitting}
          onCancel={() => {
            setCreating(false)
            setEditingFoodId(null)
          }}
          onSave={editingFoodId ? handleUpdateFood : handleCreateFood}
        />
      ) : (
        <>
          <div className="meal-food-sheet__chrome shrink-0 bg-card/90 px-4 pb-2 pt-2 backdrop-blur-xl sm:px-5 sm:pt-4">
            <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                aria-label={labels.cancel}
                className="meal-food-sheet__control flex size-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/70 text-foreground transition-colors hover:bg-muted"
                type="button"
                onClick={onClose}
              >
                <X className="size-5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={labels.logFoodChooseMeal}
                    className="flex min-w-0 items-center justify-center gap-1 justify-self-center rounded-full px-3 py-1.5 text-base font-semibold text-primary transition-colors hover:bg-primary-soft/50"
                    type="button"
                  >
                    <span className="truncate">{getMealLabel(mealType)}</span>
                    <ChevronDown className="size-4 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="z-[80] min-w-40">
                  <DropdownMenuRadioGroup value={mealType} onValueChange={(value) => onMealTypeChange(value as MealType)}>
                    {MEAL_META.map((meta) => (
                      <DropdownMenuRadioItem key={meta.type} value={meta.type}>
                        {getMealLabel(meta.type)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <div
                aria-label={labels.foodNameLanguage}
                className="meal-food-sheet__control flex h-9 items-center rounded-full border border-border/70 bg-muted/70 p-0.5"
                role="group"
              >
                {(["vi", "en"] as const).map((language) => (
                  <button
                    key={language}
                    aria-pressed={nameLanguage === language}
                    className={cn(
                      "h-full rounded-full px-2.5 font-mono text-xs font-semibold uppercase transition-colors",
                      nameLanguage === language ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    type="button"
                    onClick={() => changeNameLanguage(language)}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="meal-food-sheet__control h-12 rounded-full border-border/80 bg-muted/55 pl-11 pr-4 text-base shadow-none focus-visible:ring-primary/25"
                value={query}
                placeholder={labels.searchFoodPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setLookupMessage(null)
                }}
              />
            </div>

            <div className="mt-3 flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
              {FOOD_TABS.map((id) => (
                <button
                  key={id}
                  aria-selected={tab === id}
                  className={cn(
                    "relative shrink-0 pb-2 text-base font-medium transition-colors",
                    tab === id
                      ? "font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  role="tab"
                  type="button"
                  onClick={() => setTab(id)}
                >
                  {labels.logFoodTabs[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-width:thin] sm:px-5">
            <div className="grid grid-cols-2 gap-2.5 py-3">
              <button
                className="meal-food-sheet__control flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-muted/60 px-2 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-muted disabled:opacity-60"
                disabled={lookingUp}
                type="button"
                onClick={runAiLookup}
              >
                {lookingUp ? <Loader2 className="size-6 animate-spin" /> : <Sparkles className="size-6" />}
                {lookingUp ? labels.aiLookupLoading : labels.logFoodAiLookup}
              </button>
              <button
                className="meal-food-sheet__control flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-muted/60 px-2 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-muted"
                type="button"
                onClick={() => startCreating(trimmedQuery ? { name: trimmedQuery } : null)}
              >
                <Plus className="size-6" />
                {labels.logFoodCreate}
              </button>
            </div>
            {lookupMessage ? <p className="-mt-1 mb-2 text-center text-xs text-destructive-text">{lookupMessage}</p> : null}

            <h3 className="mb-2.5 mt-2 text-xl font-semibold text-foreground">
              {trimmedQuery ? labels.logFoodResults : tab === "all" ? labels.logFoodAllFoods : labels.logFoodTabs[tab]}
            </h3>

            <ul className="space-y-2">
              {filteredFoods.map((food) => {
                const active = selectedFood?.id === food.id
                const verified = food.source === "system" && food.reviewStatus === "approved"
                return (
                  <li
                    key={food.id}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border pl-4 pr-2.5 transition-colors",
                      active ? "border-primary bg-primary-soft" : "meal-food-sheet__row border-border/40 bg-card/50 hover:bg-muted/60",
                    )}
                  >
                    <button className="min-w-0 flex-1 py-3 text-left" type="button" onClick={() => pickFood(food)}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-base font-medium text-foreground">{nameOf(food)}</span>
                        {verified ? <BadgeCheck aria-label={labels.logFoodVerified} className="size-4 shrink-0 text-success-text" /> : null}
                        {food.source === "user" ? (
                          <Badge variant={food.reviewStatus === "rejected" ? "destructive" : "secondary"} className="shrink-0 text-micro">
                            {food.reviewStatus === "rejected" ? labels.rejectedReview : labels.pendingReview}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground tnum">
                        {Math.round(food.calories)} kcal, {servingOf(food)}
                      </span>
                    </button>
                    {food.source === "user" ? (
                      <button
                        aria-label={labels.editFood(nameOf(food))}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        type="button"
                        onClick={() => startEditing(food)}
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : null}
                    <button
                      aria-label={labels.logFoodQuickAdd(nameOf(food))}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                      disabled={submitting}
                      type="button"
                      onClick={() => quickAdd(food)}
                    >
                      <Plus className="size-5" />
                    </button>
                  </li>
                )
              })}
            </ul>

            {filteredFoods.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">{trimmedQuery ? labels.noFoodsFound : labels.logFoodEmptyTab}</p>
                {canLookup ? (
                  <>
                    <Button className="max-w-full rounded-full" disabled={lookingUp} type="button" onClick={() => void lookupFood()}>
                      {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span className="truncate">{lookingUp ? labels.aiLookupLoading : labels.aiLookupFood(trimmedQuery)}</span>
                    </Button>
                    <p className="max-w-xs text-xs text-muted-foreground">{labels.aiLookupHint}</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {selectedFood ? (
            <BottomSheetFooter className="meal-food-sheet__chrome flex-wrap gap-3 border-border/70 bg-card/95 backdrop-blur-xl">
              <div className="w-full sm:w-auto sm:min-w-[130px] sm:flex-1">
                <p className="text-sm font-semibold text-foreground">{nameOf(selectedFood)}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground tnum">
                  {Math.round(selectedFood.calories * multiplier)} kcal · P{Math.round(selectedFood.protein * multiplier)} C
                  {Math.round(selectedFood.carbs * multiplier)} F{Math.round(selectedFood.fat * multiplier)}
                </p>
                {lastPortion ? (
                  <p className="mt-0.5 text-micro text-muted-foreground">
                    {labels.lastPortion(`${formatMetric(lastPortion.amountValue, 1)} ${lastPortion.amountUnit === "serving" ? "×" : lastPortion.amountUnit}`)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  className="h-[30px] w-[30px] rounded-md"
                  size="icon"
                  type="button"
                  variant="outline"
                  onClick={() => setAmountValue((value) => Math.max(amountUnit === "serving" ? 0.5 : 1, amountUnit === "serving" ? value - 0.5 : value - 10))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="relative">
                  <Input
                    className="h-[30px] w-24 pr-8 text-right font-mono tnum sm:w-[76px]"
                    inputMode="decimal"
                    type="number"
                    value={amountValue}
                    onChange={(event) => setAmountValue(Math.max(0, Number(event.target.value) || 0))}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-micro text-muted-foreground">
                    {amountUnit === "serving" ? "x" : amountUnit}
                  </span>
                </div>
                <Button
                  className="h-[30px] w-[30px] rounded-md"
                  size="icon"
                  type="button"
                  variant="outline"
                  onClick={() => setAmountValue((value) => (amountUnit === "serving" ? value + 0.5 : value + 10))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button className="h-10 flex-1 rounded-full px-5 sm:flex-none" disabled={submitting || amountValue <= 0} type="button" onClick={() => onAdd({ amountUnit, amountValue, food: selectedFood })}>
                <Check className="h-4 w-4" />
                {labels.addFoodItem}
              </Button>
            </BottomSheetFooter>
          ) : null}
        </>
      )}
    </BottomSheet>
  )
}

export function MealsClient({ initialData }: { initialData?: MealsClientInitialData } = {}) {
  const { session } = useAuth()
  const { locale, messages } = useLocale()
  const searchParams = useSearchParams()
  const hasHydrated = useHasHydrated()
  const initialDateKey = initialData?.selectedDateKey ?? formatDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date(`${initialDateKey}T00:00:00`))
  const [addTo, setAddTo] = useState<MealType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAIMealPlan, setShowAIMealPlan] = useState(false)
  const [showNutritionDetails, setShowNutritionDetails] = useState(false)
  const [initialFoodId, setInitialFoodId] = useState<string | null>(null)
  const selectedDateKey = formatDateKey(selectedDate)
  const requestedMeal = searchParams.get("meal")
  const highlightedMeal = MEAL_META.some((meta) => meta.type === requestedMeal) ? requestedMeal as MealType : null

  const dayQuery = useNutritionDay(selectedDateKey, {
    initialData: selectedDateKey === initialData?.selectedDateKey ? initialData.nutritionDay : undefined,
  })
  const foodsQuery = useFoods(undefined, { initialData: initialData?.foods })
  const addItem = useAddMealItem(selectedDateKey)
  const deleteItem = useDeleteMealItem(selectedDateKey)
  const consumePlan = useConsumePlannedMeals(selectedDateKey)
  const updateItemAmount = useUpdateMealItemAmount(selectedDateKey)
  const createFood = useCreateCustomFood()
  const updateFood = useUpdateCustomFood()
  const lookupFood = useFoodNutritionLookup()
  const canUseClientData = Boolean(initialData) || hasHydrated
  const nutritionDay = (canUseClientData ? dayQuery.data : undefined) ?? {
    date: selectedDate,
    meals: [],
    recentFoods: [],
    targets: initialData?.nutritionDay?.targets ?? DEFAULT_NUTRITION_TARGETS,
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  }
  const foods = canUseClientData ? foodsQuery.data ?? [] : []
  const isLoading = !canUseClientData || dayQuery.isPending
  const loadDay = () => dayQuery.refetch()
  const displayError = error ?? dayQuery.error?.message ?? foodsQuery.error?.message

  useEffect(() => {
    if (!highlightedMeal) return

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`meal-section-${highlightedMeal}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 120)

    return () => {
      window.clearTimeout(scrollTimer)
    }
  }, [highlightedMeal])

  const handleConsumePlan = async (mealType?: MealType) => {
    setError(null)
    try {
      await consumePlan.mutateAsync(mealType)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được bữa ăn. Vui lòng thử lại.")
    }
  }

  const handleChangePlannedAmount = async (itemId: string, amountValue: number) => {
    setError(null)
    try {
      await updateItemAmount.mutateAsync({ itemId, amountValue })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được khẩu phần. Vui lòng thử lại.")
    }
  }

  const mealsByType = useMemo(() => new Map(nutritionDay.meals.map((meal) => [meal.type, meal])), [nutritionDay.meals])
  const totals = nutritionDay.totals
  const targets = nutritionDay.targets
  const remaining = targets.calories - totals.calories
  const todayKey = formatDateKey(new Date())
  const selectedDateLabel = selectedDateKey === todayKey ? messages.meals.today : messages.meals.selectedDay
  const dateLocale = locale === "vi" ? vi : enUS
  const modalLabels = {
    addFoodItem: messages.meals.addFoodItem,
    addToMeal: messages.meals.addToMeal,
    aiConfidence: messages.meals.aiConfidence,
    aiEstimateReview: messages.meals.aiEstimateReview,
    aiEstimateTitle: messages.meals.aiEstimateTitle,
    aiLookupError: messages.meals.aiLookupError,
    aiLookupFood: messages.meals.aiLookupFood,
    aiLookupHint: messages.meals.aiLookupHint,
    aiLookupLoading: messages.meals.aiLookupLoading,
    aiLookupNotFound: messages.meals.aiLookupNotFound,
    calories: messages.meals.calories,
    cancel: messages.common.cancel,
    carbs: messages.meals.carbs,
    createFoodTitle: messages.meals.createFoodTitle,
    createNewFood: messages.meals.createNewFood,
    fat: messages.meals.fat,
    foodGroup: messages.meals.foodGroup,
    foodLibrary: messages.meals.foodLibrary,
    foodName: messages.meals.foodName,
    foodNameEn: messages.meals.foodNameEn,
    foodNameEnPlaceholder: messages.meals.foodNameEnPlaceholder,
    foodNameLanguage: messages.meals.foodNameLanguage,
    foodNamePlaceholder: messages.meals.foodNameNewPlaceholder,
    lastPortion: messages.meals.lastPortion,
    logFoodAiLookup: messages.meals.logFoodAiLookup,
    logFoodAiNeedsQuery: messages.meals.logFoodAiNeedsQuery,
    logFoodAllFoods: messages.meals.logFoodAllFoods,
    logFoodChooseMeal: messages.meals.logFoodChooseMeal,
    logFoodCreate: messages.meals.logFoodCreate,
    logFoodEmptyTab: messages.meals.logFoodEmptyTab,
    logFoodQuickAdd: messages.meals.logFoodQuickAdd,
    logFoodResults: messages.meals.logFoodResults,
    logFoodTabs: messages.meals.logFoodTabs,
    logFoodVerified: messages.meals.logFoodVerified,
    editFood: messages.meals.editFood,
    editFoodResubmit: messages.meals.editFoodResubmit,
    editFoodTitle: messages.meals.editFoodTitle,
    reviewNoteFromAdmin: messages.meals.reviewNoteFromAdmin,
    saveChanges: messages.meals.saveChanges,
    logFood: messages.meals.logFood,
    noFoodsFound: messages.meals.noFoodsFound,
    pendingReview: messages.meals.pendingReview,
    protein: messages.meals.protein,
    rejectedReview: messages.meals.rejectedReview,
    recentFoods: messages.meals.recentFoods,
    recentFoodsHint: messages.meals.recentFoodsHint,
    saveFood: messages.meals.saveFood,
    searchFoodPlaceholder: messages.meals.searchFoodPlaceholder,
    serving: messages.meals.serving,
    servingHint: messages.meals.servingHint,
    servingPlaceholder: messages.meals.servingPlaceholder,
  }
  const getCategoryLabel = (category: FoodCategory | "all") => {
    const labelKey = FOOD_CATEGORIES.find((item) => item.id === category)?.labelKey ?? "allFoods"
    return String(messages.meals[labelKey])
  }
  const getMealLabel = (mealType: MealType) => {
    const mealLabels: Record<MealType, string> = {
      breakfast: messages.meals.breakfast,
      dinner: messages.meals.dinner,
      lunch: messages.meals.lunch,
      snack: messages.meals.snack,
    }
    return mealLabels[mealType]
  }

  async function handleAddFood(input: { amountUnit: "g" | "ml" | "serving"; amountValue: number; food: NutritionFood }) {
    if (!session?.access_token || !addTo) {
      return
    }

    const mealType = addTo
    const dateKey = selectedDateKey
    setIsSubmitting(true)
    setAddTo(null)
    setError(null)
    try {
      await addItem.mutateAsync({
        amountUnit: input.amountUnit,
        amountValue: input.amountValue,
        date: dateKey,
        foodId: input.food.id,
        mealType,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.addFoodError)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreateFood(input: Parameters<typeof createCustomFood>[1]) {
    if (!session?.access_token) {
      return null
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const food = await createFood.mutateAsync(input)
      return food
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.createFoodError)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateFood(foodId: string, input: Parameters<typeof createCustomFood>[1]) {
    setIsSubmitting(true)
    setError(null)
    try {
      return await updateFood.mutateAsync({ foodId, input })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.createFoodError)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!session?.access_token) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await deleteItem.mutateAsync(itemId)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.deleteFoodError)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !canUseClientData && !initialData) {
    return <MealsLoadingState />
  }

  if (dayQuery.isPending && !dayQuery.data) {
    return <MealsLoadingState />
  }

  if (dayQuery.isError && !dayQuery.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-page md:px-6">
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-4 text-center">
          <p className="text-sm text-destructive-text">{messages.meals.loadNutritionError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void dayQuery.refetch()}>
            {messages.common.tryAgain}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-page md:px-6">
      <div className="mb-5">
        <WeeklyCalendarStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      <div className="mb-5 flex items-center justify-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedDate((date) => addDays(date, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-[150px] text-center">
          <p className="font-semibold text-foreground">{selectedDateLabel}</p>
          <p className="text-sm text-muted-foreground">{format(selectedDate, "EEEE, dd/MM", { locale: dateLocale })}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedDate((date) => addDays(date, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {displayError ? <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">{displayError}</div> : null}

      <section className="relative mb-5 rounded-lg border border-border bg-card p-4 md:mb-6 md:p-6" data-tour="trainee-nutrition-summary">
        <NutritionInsightButton
          className="absolute right-3 top-3 md:right-4 md:top-4"
          dateKey={selectedDateKey}
          hasIntake={totals.calories > 0}
          onPickFood={(foodId) => {
            setInitialFoodId(foodId)
            setAddTo(mealTypeForNow())
          }}
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-9">
          <div className="flex items-center gap-4 pr-10 md:pr-0">
            <CalorieRing consumed={totals.calories} target={targets.calories} totals={totals} />
            <div>
              <p className="label-micro">{messages.meals.calories}</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-semibold tracking-[-0.03em] tnum md:text-3xl", remaining < 0 ? "text-warning-text" : "text-foreground")}>
                  {Math.abs(Math.round(remaining)).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">{remaining < 0 ? messages.meals.kcalOver : messages.meals.kcalLeft}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
                {messages.meals.eatenGoal(Math.round(totals.calories).toLocaleString(), targets.calories.toLocaleString())}
              </p>
            </div>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-2.5 md:gap-3">
            <MacroBar colorClassName="bg-primary" label={messages.meals.protein} consumed={totals.protein} target={targets.protein} />
            <MacroBar colorClassName="bg-success" label={messages.meals.carbs} consumed={totals.carbs} target={targets.carbs} />
            <MacroBar colorClassName="bg-warning" label={messages.meals.fat} consumed={totals.fat} target={targets.fat} />
            <MacroBar
              colorClassName="bg-info"
              label={messages.meals.fiber}
              consumed={totals.fiber ?? 0}
              target={targets.fiber ?? 0}
              warnOverTarget={false}
            />
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-2.5">
          <button
            aria-expanded={showNutritionDetails}
            className="flex w-full items-center justify-between gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            type="button"
            onClick={() => setShowNutritionDetails((open) => !open)}
          >
            {showNutritionDetails ? messages.meals.hideNutritionDetails : messages.meals.nutritionDetails}
            <ChevronDown className={cn("size-4 transition-transform", showNutritionDetails && "rotate-180")} />
          </button>
          {showNutritionDetails ? (
            <div className="mt-4">
              <NutritionDetails coverage={nutritionDay.nutrientCoverage} lines={nutritionDay.micronutrients ?? []} />
            </div>
          ) : null}
        </div>
      </section>


      <div className="mb-5 grid grid-cols-2 gap-2 md:mb-6 md:flex md:justify-end" data-tour="trainee-nutrition-actions">
        <Button variant="outline" className="gap-1.5" type="button" onClick={() => setShowAIMealPlan(true)}>
          <Bot className="h-4 w-4" />
          {messages.meals.aiSuggest}
        </Button>
        <Button type="button" onClick={() => setAddTo("snack")}>
          <Plus className="h-4 w-4" />
          {messages.meals.quickAdd}
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div data-tour="trainee-nutrition-log">
          <p className="label-micro mb-3">{messages.meals.meals}</p>
          <div className={cn("space-y-3", isLoading && "opacity-60")}>
            {MEAL_META.map((meta) => (
              <MealSection
                key={meta.type}
                deleteLabel={messages.meals.deleteFoodItem}
                highlight={highlightedMeal === meta.type}
                isSubmitting={isSubmitting}
                label={getMealLabel(meta.type)}
                meal={mealsByType.get(meta.type) ?? { calories: 0, name: getMealLabel(meta.type), type: meta.type }}
                meta={meta}
                onAdd={setAddTo}
                onDeleteItem={(itemId) => void handleDeleteItem(itemId)}
              />
            ))}
          </div>
        </div>

        <div className="lg:mt-7">
          <MacroSplit
            labels={{
              carbs: messages.meals.carbs,
              fat: messages.meals.fat,
              protein: messages.meals.protein,
              title: messages.meals.macroSplitToday,
            }}
            totals={totals}
          />
        </div>
      </div>

      {nutritionDay.plannedMeals?.length ? (
        <section className="mt-5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Thực đơn AI dự kiến</p>
              <p className="text-xs text-muted-foreground">Chưa cộng vào lượng đã ăn. Chỉnh khẩu phần nếu cần, bấm &quot;Đã ăn&quot; sau khi ăn xong từng bữa.</p>
              {nutritionDay.plannedMeals.some((meal) => meal.coachReviewedAt) ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="size-3.5" />
                  Coach đã duyệt
                </p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" disabled={consumePlan.isPending} onClick={() => void handleConsumePlan()}>
              Đã ăn tất cả
            </Button>
          </div>
          <div className="mt-3">
            <PlannedMealsList
              meals={nutritionDay.plannedMeals}
              getMealLabel={getMealLabel}
              disabled={consumePlan.isPending || updateItemAmount.isPending || deleteItem.isPending}
              onChangeAmount={(itemId, amountValue) => void handleChangePlannedAmount(itemId, amountValue)}
              onDeleteItem={(itemId) => void handleDeleteItem(itemId)}
              onConsumeMeal={(type) => void handleConsumePlan(type)}
            />
          </div>
        </section>
      ) : null}

      {addTo ? (
        <AddFoodModal
          defaultNameLanguage={locale === "en" ? "en" : "vi"}
          foods={foods}
          initialFoodId={initialFoodId}
          lastPortions={nutritionDay.lastPortions ?? {}}
          getCategoryLabel={getCategoryLabel}
          getMealLabel={getMealLabel}
          labels={modalLabels}
          mealType={addTo}
          recentFoods={nutritionDay.recentFoods}
          submitting={isSubmitting}
          onAdd={(input) => void handleAddFood(input)}
          onClose={() => {
            setAddTo(null)
            setInitialFoodId(null)
          }}
          onCreateFood={handleCreateFood}
          onLookupFood={(query) => lookupFood.mutateAsync({ locale: locale === "en" ? "en" : "vi", query })}
          onMealTypeChange={setAddTo}
          onUpdateFood={handleUpdateFood}
        />
      ) : null}

      {showAIMealPlan && session?.access_token ? (
        <MealPlanGenerator
          accessToken={session.access_token}
          date={selectedDateKey}
          onAccepted={() => {
            setShowAIMealPlan(false)
            void loadDay()
          }}
          onClose={() => setShowAIMealPlan(false)}
        />
      ) : null}
    </div>
  )
}
