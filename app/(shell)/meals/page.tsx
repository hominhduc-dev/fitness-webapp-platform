"use client"

import { addDays, format } from "date-fns"
import { ChevronLeft, ChevronRight, Flame } from "lucide-react"
import { useEffect, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { AddMealDialog } from "@/components/meals/add-meal-dialog"
import { MealTypeList } from "@/components/meals/meal-type-list"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { createMeal, deleteMeal, fetchMeals, updateMeal } from "@/lib/fitness/api"
import type { WeeklyCaloriesPoint } from "@/lib/fitness/types"
import type { Meal } from "@/lib/types"

export default function MealsPage() {
  const { locale, messages } = useLocale()
  const { isLoading: authLoading, session } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [meals, setMeals] = useState<Meal[]>([])
  const [targetCalories, setTargetCalories] = useState(2500)
  const [weeklyCalories, setWeeklyCalories] = useState<WeeklyCaloriesPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creatingMealType, setCreatingMealType] = useState<Meal["type"] | null>(null)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
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

  useEffect(() => {
    if (!session?.access_token) {
      if (!authLoading) {
        setMeals([])
        setWeeklyCalories([])
        setIsLoading(false)
      }

      return
    }

    void loadMeals(session.access_token, selectedDateKey)
  }, [authLoading, selectedDateKey, session?.access_token])

  const totalCalories = meals.reduce((accumulator, meal) => accumulator + meal.calories, 0)
  const remaining = targetCalories - totalCalories
  const percentage = targetCalories > 0 ? Math.min(100, Math.round((totalCalories / targetCalories) * 100)) : 0
  const totalProtein = meals.reduce((accumulator, meal) => accumulator + (meal.protein || 0), 0)
  const totalCarbs = meals.reduce((accumulator, meal) => accumulator + (meal.carbs || 0), 0)
  const totalFat = meals.reduce((accumulator, meal) => accumulator + (meal.fat || 0), 0)

  const handleAddMeal = async (mealData: Omit<Meal, "id" | "time">) => {
    if (!session?.access_token) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createMeal(session.access_token, {
        calories: mealData.calories,
        carbs: mealData.carbs,
        fat: mealData.fat,
        name: mealData.name,
        protein: mealData.protein,
        recordedAt: selectedDate.toISOString(),
        type: mealData.type,
      })
      await loadMeals(session.access_token, selectedDateKey)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "en" ? "Unable to save the meal." : "Không thể lưu bữa ăn.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteMeal = async (mealId: string) => {
    if (!session?.access_token) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await deleteMeal(session.access_token, mealId)
      await loadMeals(session.access_token, selectedDateKey)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "en" ? "Unable to delete the meal." : "Không thể xóa bữa ăn.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateMeal = async (mealData: Omit<Meal, "id" | "time">) => {
    if (!session?.access_token || !editingMeal) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await updateMeal(session.access_token, editingMeal.id, {
        calories: mealData.calories,
        carbs: mealData.carbs,
        fat: mealData.fat,
        name: mealData.name,
        protein: mealData.protein,
        recordedAt: editingMeal.time.toISOString(),
        type: mealData.type,
      })
      setEditingMeal(null)
      await loadMeals(session.access_token, selectedDateKey)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "en" ? "Unable to update the meal." : "Không thể cập nhật bữa ăn.")
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
        <AddMealDialog onAdd={handleAddMeal} />
      </div>

      <AddMealDialog
        defaultType={creatingMealType ?? undefined}
        description={messages.meals.addMealDescription}
        onAdd={handleAddMeal}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingMealType(null)
          }
        }}
        open={creatingMealType !== null}
        title={messages.meals.addMealTitle}
        trigger={null}
      />

      <AddMealDialog
        description={messages.meals.editMealDescription}
        initialMeal={editingMeal ?? undefined}
        onAdd={handleUpdateMeal}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMeal(null)
          }
        }}
        open={Boolean(editingMeal)}
        submitLabel={messages.meals.saveMeal}
        title={messages.meals.editMeal}
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
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, locale === "en" ? "EEEE, MMM d" : "EEEE, dd/MM")}
                </p>
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
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{messages.meals.dailyCalories}</p>
                      <p className="text-3xl font-bold mt-1">
                        {totalCalories}{" "}
                        <span className="text-lg font-normal text-muted-foreground">/ {targetCalories} kcal</span>
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
                      {remaining > 0 ? messages.meals.remaining(remaining) : messages.meals.overTarget(remaining)}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-info/10 p-3 text-center">
                      <p className="text-2xl font-bold text-info">{totalProtein}g</p>
                      <p className="text-xs text-muted-foreground">{messages.meals.protein}</p>
                    </div>
                    <div className="rounded-lg bg-warning/10 p-3 text-center">
                      <p className="text-2xl font-bold text-warning">{totalCarbs}g</p>
                      <p className="text-xs text-muted-foreground">{messages.meals.carbs}</p>
                    </div>
                    <div className="rounded-lg bg-accent/10 p-3 text-center">
                      <p className="text-2xl font-bold text-accent">{totalFat}g</p>
                      <p className="text-xs text-muted-foreground">{messages.meals.fat}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-4 text-lg font-semibold">{messages.meals.meals}</h2>
                  {isLoading ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                      {messages.meals.loadingMeals}
                    </div>
                  ) : (
                    <MealTypeList
                      isSubmitting={isSubmitting}
                      meals={meals}
                      onAddMealType={setCreatingMealType}
                      onDeleteMeal={(mealId) => void handleDeleteMeal(mealId)}
                      onEditMeal={setEditingMeal}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold">{messages.meals.weeklyTrend}</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyCalories}>
                        <defs>
                          <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#9CA3AF", fontSize: 12 }}
                        />
                        <YAxis hide domain={[0, 3000]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1F2937",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#F9FAFB" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="calories"
                          stroke="#22C55E"
                          strokeWidth={2}
                          fill="url(#calorieGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="target"
                          stroke="#374151"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{messages.meals.actual}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                      <span className="text-muted-foreground">{messages.meals.target}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold">{messages.meals.quickAdd}</h3>
                  <div className="space-y-2">
                    {[
                      { calories: 180, name: "Protein Shake" },
                      { calories: 120, name: "Greek Yogurt" },
                      { calories: 105, name: "Banana" },
                      { calories: 450, name: "Rice & Chicken" },
                    ].map((item) => (
                      <button
                        key={item.name}
                        onClick={() =>
                          void handleAddMeal({
                            calories: item.calories,
                            name: item.name,
                            type: "snack",
                          })
                        }
                        className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">{item.calories} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
    </div>
  )
}
