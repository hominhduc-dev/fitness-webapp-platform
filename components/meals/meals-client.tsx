"use client"

import { addDays, format } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Minus,
  Plus,
  Search,
  Sun,
  Sunrise,
  Sunset,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addMealItem, createCustomFood, deleteMealItem, fetchNutritionDay } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"
import type { FoodCategory, Meal, MealType, NutritionFood } from "@/lib/types"

type NutritionTargets = {
  calories: number
  carbs: number
  fat: number
  protein: number
}

type NutritionTotals = {
  calories: number
  carbs: number
  fat: number
  fiber?: number
  protein: number
  sodium?: number
  sugar?: number
}

type NutritionDay = {
  date: Date
  meals: Meal[]
  recentFoods: NutritionFood[]
  targets: NutritionTargets
  totals: NutritionTotals
}

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

const MEAL_META: Array<{ icon: LucideIcon; type: MealType }> = [
  { icon: Sunrise, type: "breakfast" },
  { icon: Sun, type: "lunch" },
  { icon: Sunset, type: "dinner" },
  { icon: Cookie, type: "snack" },
]

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatMetric(value?: number, digits = 1) {
  const safeValue = value ?? 0
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(digits)
}

function getMacro(meal: Meal, key: "carbs" | "fat" | "protein") {
  return meal[key] ?? 0
}

function getOptionalMetric(meal: Meal, key: "fiber" | "sodium" | "sugar") {
  return meal[key] ?? 0
}

function recalculateTotals(meals: Meal[]): NutritionTotals {
  return meals.reduce<NutritionTotals>(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      carbs: totals.carbs + getMacro(meal, "carbs"),
      fat: totals.fat + getMacro(meal, "fat"),
      fiber: (totals.fiber ?? 0) + getOptionalMetric(meal, "fiber"),
      protein: totals.protein + getMacro(meal, "protein"),
      sodium: (totals.sodium ?? 0) + getOptionalMetric(meal, "sodium"),
      sugar: (totals.sugar ?? 0) + getOptionalMetric(meal, "sugar"),
    }),
    {
      calories: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      protein: 0,
      sodium: 0,
      sugar: 0,
    },
  )
}

function replaceMeal(nutritionDay: NutritionDay, meal: Meal, dateKey: string): NutritionDay {
  if (formatDateKey(nutritionDay.date) !== dateKey) {
    return nutritionDay
  }

  const meals = nutritionDay.meals.map((currentMeal) => (currentMeal.type === meal.type ? meal : currentMeal))

  return {
    ...nutritionDay,
    meals,
    totals: recalculateTotals(meals),
  }
}

function prependRecentFood(recentFoods: NutritionFood[], food: NutritionFood) {
  return [food, ...recentFoods.filter((recentFood) => recentFood.id !== food.id)].slice(0, 10)
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const overTarget = consumed > target

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          strokeWidth="10"
          className={cn("transition-all duration-300", overTarget ? "text-warning" : "text-primary")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[26px] font-semibold leading-none text-foreground tnum">
          {Math.round(consumed).toLocaleString()}
        </span>
        <span className="mt-1 font-mono text-[11px] text-muted-foreground tnum">
          / {Math.round(target).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function MacroBar({
  accent,
  consumed,
  label,
  target,
}: {
  accent?: boolean
  consumed: number
  label: string
  target: number
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const overTarget = consumed > target

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground tnum">
          <span className="font-semibold text-foreground">{formatMetric(consumed)}</span> / {target} g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", overTarget ? "bg-warning" : accent ? "bg-primary" : "bg-ink-600")}
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
    <section className="rounded-[10px] border border-border bg-card p-[18px]">
      <p className="label-micro mb-3.5">{labels.title}</p>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const pct = Math.round((row.value / totalMacroCals) * 100)
          return (
            <div key={row.label} className="grid grid-cols-[60px_minmax(0,1fr)_38px] items-center gap-2.5">
              <span className="text-[13px] text-muted-foreground">{row.label}</span>
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
  isSubmitting,
  label,
  meal,
  meta,
  onAdd,
  onDeleteItem,
}: {
  deleteLabel: string
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
    <section className="overflow-hidden rounded-[10px] border border-border bg-card">
      <div className={cn("flex items-center gap-2.5 px-4 py-3.5", items.length > 0 && "border-b border-border")}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-[15px] w-[15px]" />
        </div>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{label}</h3>
        <span className="font-mono text-[13px] text-muted-foreground tnum">{Math.round(meal.calories)} kcal</span>
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
            <p className="truncate text-[13.5px] text-foreground">
              {item.name}
              {item.amountLabel ? <span className="text-muted-foreground"> {item.amountLabel}</span> : null}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tnum">
              P{formatMetric(item.protein, 0)} · C{formatMetric(item.carbs, 0)} · F{formatMetric(item.fat, 0)}
            </p>
          </div>
          <span className="font-mono text-[13px] text-muted-foreground tnum">{Math.round(item.calories)}</span>
          <button
            className="rounded p-1 text-ink-200 transition-colors hover:text-destructive"
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

function CategoryChips({
  active,
  getLabel,
  onChange,
}: {
  active: FoodCategory | "all"
  getLabel: (category: FoodCategory | "all") => string
  onChange: (category: FoodCategory | "all") => void
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {FOOD_CATEGORIES.map((category) => (
        <button
          key={category.id}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            active === category.id
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
          type="button"
          onClick={() => onChange(category.id)}
        >
          {getLabel(category.id)}
        </button>
      ))}
    </div>
  )
}

function CreateFoodForm({
  getCategoryLabel,
  labels,
  onCancel,
  onSave,
  saving,
}: {
  getCategoryLabel: (category: FoodCategory | "all") => string
  labels: {
    calories: string
    cancel: string
    createFoodTitle: string
    fat: string
    foodGroup: string
    foodLibrary: string
    foodName: string
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
    protein?: number
    servingLabel: string
  }) => Promise<void> | void
  saving: boolean
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<FoodCategory>("dish")
  const [servingLabel, setServingLabel] = useState("100 g")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const canSave = name.trim() && servingLabel.trim() && Number(calories) > 0

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="label-micro mb-1.5">{labels.foodLibrary}</p>
          <h2 className="text-lg font-semibold text-foreground">{labels.createFoodTitle}</h2>
        </div>
        <button className="rounded p-1 text-muted-foreground hover:bg-muted" type="button" onClick={onCancel}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <p className="label-micro mb-1.5">{labels.foodName}</p>
          <Input value={name} placeholder={labels.foodNamePlaceholder} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <p className="label-micro mb-2">{labels.foodGroup}</p>
          <div className="flex flex-wrap gap-1.5">
            {FOOD_CATEGORIES.filter((categoryOption) => categoryOption.id !== "all").map((categoryOption) => (
              <button
                key={categoryOption.id}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                  category === categoryOption.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground",
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
          <p className="mt-1.5 text-[11px] text-muted-foreground">{labels.servingHint}</p>
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
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
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
              protein: protein ? Number(protein) : undefined,
              servingLabel: servingLabel.trim(),
            })
          }}
        >
          <Check className="h-4 w-4" />
          {labels.saveFood}
        </Button>
      </div>
    </>
  )
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
  recentFoods,
  submitting,
}: {
  foods: NutritionFood[]
  getCategoryLabel: (category: FoodCategory | "all") => string
  getMealLabel: (mealType: MealType) => string
  labels: {
    addFoodItem: string
    addToMeal: (meal: string) => string
    calories: string
    cancel: string
    carbs: string
    createFoodTitle: string
    createNewFood: string
    fat: string
    foodGroup: string
    foodLibrary: string
    foodName: string
    foodNamePlaceholder: string
    logFood: string
    noFoodsFound: string
    protein: string
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
  recentFoods: NutritionFood[]
  submitting: boolean
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<FoodCategory | "all">("all")
  const [selectedFood, setSelectedFood] = useState<NutritionFood | null>(null)
  const [amountValue, setAmountValue] = useState(1)
  const [amountUnit, setAmountUnit] = useState<"g" | "ml" | "serving">("serving")
  const [creating, setCreating] = useState(false)
  const mealLabel = labels.addToMeal(getMealLabel(mealType))
  const filteredFoods = foods.filter((food) => {
    const matchesCategory = category === "all" || food.category === category
    const matchesQuery = !query.trim() || food.name.toLowerCase().includes(query.trim().toLowerCase())
    return matchesCategory && matchesQuery
  })
  const showRecentFoods = !query.trim() && category === "all" && recentFoods.length > 0

  function pickFood(food: NutritionFood) {
    const gramUnit = food.servingUnit === "g" || food.servingUnit === "ml" ? food.servingUnit : "serving"
    setSelectedFood(food)
    setAmountUnit(gramUnit)
    setAmountValue(gramUnit === "serving" ? 1 : food.servingAmount)
  }

  async function handleCreateFood(input: Parameters<typeof createCustomFood>[1]) {
    setCreating(false)
    setQuery("")
    setCategory("all")

    const food = await onCreateFood(input)

    if (food) {
      pickFood(food)
    }
  }

  const multiplier =
    selectedFood && amountUnit !== "serving" && selectedFood.servingUnit === amountUnit && selectedFood.servingAmount > 0
      ? amountValue / selectedFood.servingAmount
      : amountValue

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-card shadow-2xl sm:max-w-[520px] sm:rounded-[14px]"
        onClick={(event) => event.stopPropagation()}
      >
        {creating ? (
          <CreateFoodForm
            getCategoryLabel={getCategoryLabel}
            labels={labels}
            saving={submitting}
            onCancel={() => setCreating(false)}
            onSave={handleCreateFood}
          />
        ) : (
          <>
            <div className="shrink-0 border-b border-border px-5 py-4">
              <div className="mb-3.5 flex items-start justify-between gap-4">
                <div>
                  <p className="label-micro mb-1.5">{mealLabel}</p>
                  <h2 className="text-lg font-semibold text-foreground">{labels.logFood}</h2>
                </div>
                <button className="rounded p-1 text-muted-foreground hover:bg-muted" type="button" onClick={onClose}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" value={query} placeholder={labels.searchFoodPlaceholder} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="mt-3">
                <CategoryChips active={category} getLabel={getCategoryLabel} onChange={setCategory} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {showRecentFoods ? (
                <div className="border-b border-border bg-muted/25 px-5 py-3.5">
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <p className="label-micro">{labels.recentFoods}</p>
                    <p className="hidden text-[11px] text-muted-foreground sm:block">{labels.recentFoodsHint}</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {recentFoods.map((food) => {
                      const active = selectedFood?.id === food.id
                      return (
                        <button
                          key={food.id}
                          className={cn(
                            "min-w-[170px] max-w-[220px] shrink-0 rounded-[8px] border bg-card px-3 py-2 text-left transition-colors",
                            active ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                          )}
                          type="button"
                          onClick={() => pickFood(food)}
                        >
                          <p className="truncate text-[13px] font-semibold text-foreground">{food.name}</p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground tnum">
                            {Math.round(food.calories)} kcal · P{formatMetric(food.protein, 0)} C{formatMetric(food.carbs, 0)} F
                            {formatMetric(food.fat, 0)}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {filteredFoods.map((food) => {
                const active = selectedFood?.id === food.id
                return (
                  <button
                    key={food.id}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-ink-50 px-5 py-3 text-left transition-colors",
                      active ? "bg-primary-soft" : "hover:bg-muted/60",
                    )}
                    type="button"
                    onClick={() => pickFood(food)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{food.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground tnum">
                        {food.servingLabel} · P{formatMetric(food.protein, 0)} C{formatMetric(food.carbs, 0)} F{formatMetric(food.fat, 0)}
                      </p>
                    </div>
                    <span className="font-mono text-[13px] text-muted-foreground tnum">
                      {Math.round(food.calories)}
                      <span className="text-[10px]"> kcal</span>
                    </span>
                  </button>
                )
              })}
              {filteredFoods.length === 0 ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">{labels.noFoodsFound}</div> : null}
            </div>

            <div className="shrink-0 border-t border-border px-5 py-3">
              <button
                className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border px-3 py-2 text-[13px] font-medium text-primary hover:bg-primary-soft"
                type="button"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {labels.createNewFood}
              </button>
            </div>

            {selectedFood ? (
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-5 py-4">
                <div className="min-w-[130px] flex-1">
                  <p className="text-sm font-semibold text-foreground">{selectedFood.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground tnum">
                    {Math.round(selectedFood.calories * multiplier)} kcal · P{Math.round(selectedFood.protein * multiplier)} C
                    {Math.round(selectedFood.carbs * multiplier)} F{Math.round(selectedFood.fat * multiplier)}
                  </p>
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
                      className="h-[30px] w-[76px] pr-8 text-right font-mono text-sm tnum"
                      inputMode="decimal"
                      type="number"
                      value={amountValue}
                      onChange={(event) => setAmountValue(Math.max(0, Number(event.target.value) || 0))}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
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
                <Button disabled={submitting || amountValue <= 0} type="button" onClick={() => onAdd({ amountUnit, amountValue, food: selectedFood })}>
                  <Check className="h-4 w-4" />
                  {labels.addFoodItem}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function MealsClient({ initialData }: { initialData: MealsClientInitialData }) {
  const { session } = useAuth()
  const { locale, messages } = useLocale()
  const [selectedDate, setSelectedDate] = useState(() => new Date(`${initialData.selectedDateKey}T00:00:00`))
  const [nutritionDay, setNutritionDay] = useState<NutritionDay>(initialData.nutritionDay)
  const [foods, setFoods] = useState(initialData.foods)
  const [addTo, setAddTo] = useState<MealType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedDateKey = formatDateKey(selectedDate)

  async function loadDay(dateKey = selectedDateKey) {
    if (!session?.access_token) {
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      setNutritionDay(await fetchNutritionDay(session.access_token, dateKey))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : messages.meals.loadNutritionError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDateKey === initialData.selectedDateKey) {
      return
    }

    void loadDay(selectedDateKey)
  }, [selectedDateKey, session?.access_token])

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
    calories: messages.meals.calories,
    cancel: messages.common.cancel,
    carbs: messages.meals.carbs,
    createFoodTitle: messages.meals.createFoodTitle,
    createNewFood: messages.meals.createNewFood,
    fat: messages.meals.fat,
    foodGroup: messages.meals.foodGroup,
    foodLibrary: messages.meals.foodLibrary,
    foodName: messages.meals.foodName,
    foodNamePlaceholder: messages.meals.foodNameNewPlaceholder,
    logFood: messages.meals.logFood,
    noFoodsFound: messages.meals.noFoodsFound,
    protein: messages.meals.protein,
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
      const meal = await addMealItem(session.access_token, {
        amountUnit: input.amountUnit,
        amountValue: input.amountValue,
        date: dateKey,
        foodId: input.food.id,
        mealType,
      })
      setNutritionDay((current) => {
        const updated = replaceMeal(current, meal, dateKey)
        return {
          ...updated,
          recentFoods: prependRecentFood(updated.recentFoods, input.food),
        }
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
      const food = await createCustomFood(session.access_token, input)
      setFoods((current) => [food, ...current.filter((item) => item.id !== food.id)])
      return food
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
      const meal = await deleteMealItem(session.access_token, itemId)
      setNutritionDay((current) => replaceMeal(current, meal, selectedDateKey))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.deleteFoodError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="label-micro mb-2">
            {selectedDateKey === todayKey ? messages.meals.nutritionToday : messages.meals.nutritionOnDate(format(selectedDate, "dd/MM/yyyy"))}
          </p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground md:text-4xl">
            {remaining >= 0
              ? messages.meals.caloriesLeftHeadline(Math.round(remaining))
              : messages.meals.caloriesOverHeadline(Math.abs(Math.round(remaining)))}
          </h1>
        </div>
        <Button className="self-start bg-foreground text-background hover:bg-ink-900" type="button" onClick={() => setAddTo("snack")}>
          <Plus className="h-4 w-4" />
          {messages.meals.quickAdd}
        </Button>
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

      {error ? <div className="mb-5 rounded-[10px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <section className="mb-5 rounded-[10px] border border-border bg-card p-[18px] md:mb-6 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-9">
          <div className="flex items-center justify-center gap-4 md:justify-start">
            <CalorieRing consumed={totals.calories} target={targets.calories} />
            <div>
              <p className="label-micro">{messages.meals.calories}</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={cn("text-3xl font-semibold tracking-[-0.03em] tnum", remaining < 0 ? "text-warning" : "text-foreground")}>
                  {Math.abs(Math.round(remaining)).toLocaleString()}
                </span>
                <span className="text-[13px] text-muted-foreground">{remaining < 0 ? messages.meals.kcalOver : messages.meals.kcalLeft}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
                {messages.meals.eatenGoal(Math.round(totals.calories).toLocaleString(), targets.calories.toLocaleString())}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <MacroBar accent label="Protein" consumed={totals.protein} target={targets.protein} />
            <MacroBar label="Carbs" consumed={totals.carbs} target={targets.carbs} />
            <MacroBar label="Fat" consumed={totals.fat} target={targets.fat} />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div>
          <p className="label-micro mb-3">{messages.meals.meals}</p>
          <div className={cn("space-y-3", isLoading && "opacity-60")}>
            {MEAL_META.map((meta) => (
              <MealSection
                key={meta.type}
                deleteLabel={messages.meals.deleteFoodItem}
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

      {addTo ? (
        <AddFoodModal
          foods={foods}
          getCategoryLabel={getCategoryLabel}
          getMealLabel={getMealLabel}
          labels={modalLabels}
          mealType={addTo}
          recentFoods={nutritionDay.recentFoods}
          submitting={isSubmitting}
          onAdd={(input) => void handleAddFood(input)}
          onClose={() => setAddTo(null)}
          onCreateFood={handleCreateFood}
        />
      ) : null}
    </div>
  )
}
