"use client"

import { addDays, format } from "date-fns"
import { ChevronLeft, ChevronRight, Flame } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"

import { MealHistoryList } from "@/components/meals/meal-history-list"
import { MealTypeList } from "@/components/meals/meal-type-list"
import { LogFoodDialog } from "@/components/meals/log-food-dialog"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { deleteMeal, fetchMealHistory, fetchMeals } from "@/lib/fitness/api"
import type { MealHistoryPage, WeeklyCaloriesPoint } from "@/lib/fitness/types"
import type { Meal } from "@/lib/types"

const WeeklyCaloriesChart = dynamic(
  () => import("@/components/meals/weekly-calories-chart").then((mod) => mod.WeeklyCaloriesChart),
  {
    loading: () => <div className="h-48 rounded-lg bg-muted" />,
    ssr: false,
  },
)

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function roundTo(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

export type MealsClientInitialData = {
  mealHistory: MealHistoryPage
  meals: Meal[]
  selectedDateKey: string
  targetCalories: number
  weeklyCalories: WeeklyCaloriesPoint[]
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

export function MealsClient({ initialData }: { initialData: MealsClientInitialData }) {
  const { locale, messages } = useLocale()
  const { isLoading: authLoading, session } = useAuth()
  const hasConsumedInitialMeals = useRef(false)
  const hasConsumedInitialHistory = useRef(false)
  const [selectedDate, setSelectedDate] = useState(() => parseDateKey(initialData.selectedDateKey))
  const [meals, setMeals] = useState<Meal[]>(initialData.meals)
  const [targetCalories, setTargetCalories] = useState(initialData.targetCalories)
  const [weeklyCalories, setWeeklyCalories] = useState<WeeklyCaloriesPoint[]>(initialData.weeklyCalories)
  const [mealHistory, setMealHistory] = useState<Meal[]>(initialData.mealHistory.meals)
  const [mealHistoryCursor, setMealHistoryCursor] = useState<string | undefined>(initialData.mealHistory.nextCursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creatingMealType, setCreatingMealType] = useState<Meal["type"] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")

  async function loadMeals(accessToken: string, dateKey: string) {
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchMeals(accessToken, dateKey)
      setMeals(data.meals)
      setTargetCalories(data.dailyNutrition.targetCalories)
      setWeeklyCalories(data.weeklyCalories)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : locale === "en" ? "Unable to load nutrition data." : "Không thể tải dữ liệu dinh dưỡng.")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadMealHistory(
    accessToken: string,
    options?: { append?: boolean; cursor?: string; limit?: number },
  ) {
    const append = options?.append ?? false

    if (append) {
      setIsHistoryLoadingMore(true)
    } else {
      setIsHistoryLoading(true)
    }

    try {
      const data: MealHistoryPage = await fetchMealHistory(accessToken, {
        cursor: options?.cursor,
        limit: options?.limit ?? 12,
      })

      setMealHistory((current) => {
        if (!append) {
          return data.meals
        }

        const existingIds = new Set(current.map((meal) => meal.id))
        return [...current, ...data.meals.filter((meal) => !existingIds.has(meal.id))]
      })
      setMealHistoryCursor(data.nextCursor)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "en"
            ? "Unable to load meal history."
            : "Không thể tải lịch sử bữa ăn.",
      )
    } finally {
      if (append) {
        setIsHistoryLoadingMore(false)
      } else {
        setIsHistoryLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!session?.access_token) {
      if (!authLoading) {
        setMeals([])
        setMealHistory([])
        setMealHistoryCursor(undefined)
        setWeeklyCalories([])
        setIsLoading(false)
        setIsHistoryLoading(false)
      }

      return
    }

    if (!hasConsumedInitialMeals.current && selectedDateKey === initialData.selectedDateKey) {
      hasConsumedInitialMeals.current = true
      return
    }

    void loadMeals(session.access_token, selectedDateKey)
  }, [authLoading, initialData.selectedDateKey, selectedDateKey, session?.access_token])

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    if (!hasConsumedInitialHistory.current) {
      hasConsumedInitialHistory.current = true
      return
    }

    void loadMealHistory(session.access_token)
  }, [session?.access_token])

  const totalCalories = meals.reduce((accumulator, meal) => accumulator + meal.calories, 0)
  const remaining = targetCalories - totalCalories
  const percentage = targetCalories > 0 ? Math.min(100, Math.round((totalCalories / targetCalories) * 100)) : 0
  const totalProtein = meals.reduce((accumulator, meal) => accumulator + (meal.protein ?? 0), 0)
  const totalCarbs = meals.reduce((accumulator, meal) => accumulator + (meal.carbs ?? 0), 0)
  const totalFat = meals.reduce((accumulator, meal) => accumulator + (meal.fat ?? 0), 0)
  const recentFoods = useMemo(() => {
    const seen = new Set<number>()
    const items: Array<{
      fdcId: number
      lastMealType: Meal["type"]
      lastWeightGrams?: number
      name: string
      nutritionPreview?: {
        calories?: number
        carbs?: number
        fat?: number
        fiber?: number
        protein?: number
        sodium?: number
        sugar?: number
      }
    }> = []

    for (const meal of mealHistory) {
      if (!meal.fdcId || seen.has(meal.fdcId)) {
        continue
      }

      seen.add(meal.fdcId)
      const ratio = meal.weightGrams && meal.weightGrams > 0 ? 100 / meal.weightGrams : undefined

      items.push({
        fdcId: meal.fdcId,
        lastMealType: meal.type,
        lastWeightGrams: meal.weightGrams,
        name: meal.name,
        nutritionPreview: ratio
          ? {
              calories: roundTo(meal.calories * ratio, 1),
              carbs: meal.carbs != null ? roundTo(meal.carbs * ratio, 1) : undefined,
              fat: meal.fat != null ? roundTo(meal.fat * ratio, 1) : undefined,
              fiber: meal.fiber != null ? roundTo(meal.fiber * ratio, 1) : undefined,
              protein: meal.protein != null ? roundTo(meal.protein * ratio, 1) : undefined,
              sodium: meal.sodium != null ? roundTo(meal.sodium * ratio, 0) : undefined,
              sugar: meal.sugar != null ? roundTo(meal.sugar * ratio, 1) : undefined,
            }
          : undefined,
      })

      if (items.length >= 6) {
        break
      }
    }

    return items
  }, [mealHistory])

  const handleMealLogged = async () => {
    if (!session?.access_token) {
      return
    }

    await Promise.all([
      loadMeals(session.access_token, selectedDateKey),
      loadMealHistory(session.access_token),
    ])
  }

  const handleDeleteMeal = async (mealId: string) => {
    if (!session?.access_token) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await deleteMeal(session.access_token, mealId)
      await Promise.all([
        loadMeals(session.access_token, selectedDateKey),
        loadMealHistory(session.access_token),
      ])
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "en" ? "Unable to delete the meal." : "Không thể xóa bữa ăn.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{messages.meals.title}</h1>
          <p className="mt-1 text-muted-foreground">{messages.meals.subtitle}</p>
        </div>
        <LogFoodDialog onLogged={handleMealLogged} recentFoods={recentFoods} />
      </div>

      <LogFoodDialog
        defaultType={creatingMealType ?? undefined}
        description={messages.meals.addMealDescription}
        onLogged={async () => {
          await handleMealLogged()
        }}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingMealType(null)
          }
        }}
        open={creatingMealType !== null}
        recentFoods={recentFoods}
        title={messages.meals.addMealTitle}
        trigger={null}
      />

      <div className="mb-6 flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate((current) => addDays(current, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="font-semibold">
            {selectedDateKey === format(new Date(), "yyyy-MM-dd") ? messages.meals.today : messages.meals.selectedDay}
          </p>
          <p className="text-sm text-muted-foreground">{format(selectedDate, locale === "en" ? "EEEE, MMM d" : "EEEE, dd/MM")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate((current) => addDays(current, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{messages.meals.dailyCalories}</p>
                <p className="mt-1 text-3xl font-bold">
                  {Math.round(totalCalories)} <span className="text-lg font-normal text-muted-foreground">/ {Math.round(targetCalories)} kcal</span>
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Flame className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{messages.meals.progress}</span>
                <span className="font-medium">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {remaining > 0 ? messages.meals.remaining(Math.round(remaining)) : messages.meals.overTarget(Math.round(remaining))}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-info/10 p-3 text-center">
                <p className="text-2xl font-bold text-info">{formatMetric(totalProtein)}g</p>
                <p className="text-xs text-muted-foreground">{messages.meals.protein}</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-3 text-center">
                <p className="text-2xl font-bold text-warning">{formatMetric(totalCarbs)}g</p>
                <p className="text-xs text-muted-foreground">{messages.meals.carbs}</p>
              </div>
              <div className="rounded-lg bg-accent/10 p-3 text-center">
                <p className="text-2xl font-bold text-accent">{formatMetric(totalFat)}g</p>
                <p className="text-xs text-muted-foreground">{messages.meals.fat}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold">{messages.meals.meals}</h2>
            {isLoading ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">{messages.meals.loadingMeals}</div>
            ) : (
              <MealTypeList
                isSubmitting={isSubmitting}
                meals={meals}
                onAddMealType={setCreatingMealType}
                onDeleteMeal={(mealId) => void handleDeleteMeal(mealId)}
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">{messages.meals.weeklyTrend}</h3>
            <WeeklyCaloriesChart
              actualLabel={messages.meals.actual}
              targetLabel={messages.meals.target}
              weeklyCalories={weeklyCalories}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-2 text-lg font-semibold">{messages.meals.addMealTitle}</h3>
            <p className="text-sm text-muted-foreground">{messages.meals.relogHint}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <MealHistoryList
          isLoading={isHistoryLoading}
          isLoadingMore={isHistoryLoadingMore}
          meals={mealHistory}
          nextCursor={mealHistoryCursor}
          onLoadMore={() => {
            if (!session?.access_token || !mealHistoryCursor || isHistoryLoadingMore) {
              return
            }

            void loadMealHistory(session.access_token, {
              append: true,
              cursor: mealHistoryCursor,
            })
          }}
        />
      </div>
    </div>
  )
}
