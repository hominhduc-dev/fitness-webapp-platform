"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { MealCard } from "@/components/meals/meal-card"
import { AddMealDialog } from "@/components/meals/add-meal-dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Flame } from "lucide-react"
import { todaysMeals, dailyNutrition, weeklyCaloriesData } from "@/lib/mock-data"
import { format } from "date-fns"
import type { Meal } from "@/lib/types"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>(todaysMeals)
  const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0)
  const targetCalories = dailyNutrition.targetCalories
  const remaining = targetCalories - totalCalories
  const percentage = Math.round((totalCalories / targetCalories) * 100)

  const handleAddMeal = (mealData: Omit<Meal, "id" | "time">) => {
    const newMeal: Meal = {
      ...mealData,
      id: Date.now().toString(),
      time: new Date(),
    }
    setMeals([...meals, newMeal])
  }

  const totalProtein = meals.reduce((acc, m) => acc + (m.protein || 0), 0)
  const totalCarbs = meals.reduce((acc, m) => acc + (m.carbs || 0), 0)
  const totalFat = meals.reduce((acc, m) => acc + (m.fat || 0), 0)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Meal Tracking</h1>
                <p className="mt-1 text-muted-foreground">Track your daily nutrition and calories</p>
              </div>
              <AddMealDialog onAdd={handleAddMeal} />
            </div>

            {/* Date navigation */}
            <div className="mb-6 flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <p className="font-semibold">Today</p>
                <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
              </div>
              <Button variant="ghost" size="icon">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Daily summary card */}
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">DAILY CALORIES</p>
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
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{percentage}%</span>
                    </div>
                    <Progress value={percentage} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {remaining > 0 ? `${remaining} kcal remaining` : `${Math.abs(remaining)} kcal over target`}
                    </p>
                  </div>

                  {/* Macro breakdown */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-info/10 p-3 text-center">
                      <p className="text-2xl font-bold text-info">{totalProtein}g</p>
                      <p className="text-xs text-muted-foreground">Protein</p>
                    </div>
                    <div className="rounded-lg bg-warning/10 p-3 text-center">
                      <p className="text-2xl font-bold text-warning">{totalCarbs}g</p>
                      <p className="text-xs text-muted-foreground">Carbs</p>
                    </div>
                    <div className="rounded-lg bg-accent/10 p-3 text-center">
                      <p className="text-2xl font-bold text-accent">{totalFat}g</p>
                      <p className="text-xs text-muted-foreground">Fat</p>
                    </div>
                  </div>
                </div>

                {/* Meals list */}
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Today's Meals</h2>
                  {meals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center">
                      <p className="text-muted-foreground mb-4">No meals logged today</p>
                      <AddMealDialog onAdd={handleAddMeal} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {meals.map((meal) => (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          onEdit={() => console.log("Edit meal", meal.id)}
                          onDelete={() => setMeals(meals.filter((m) => m.id !== meal.id))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Weekly trend */}
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold">Weekly Trend</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyCaloriesData}>
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
                      <span className="text-muted-foreground">Actual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                      <span className="text-muted-foreground">Target</span>
                    </div>
                  </div>
                </div>

                {/* Quick add meals */}
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold">Quick Add</h3>
                  <div className="space-y-2">
                    {[
                      { name: "Protein Shake", calories: 180 },
                      { name: "Greek Yogurt", calories: 120 },
                      { name: "Banana", calories: 105 },
                      { name: "Rice & Chicken", calories: 450 },
                    ].map((item) => (
                      <button
                        key={item.name}
                        onClick={() =>
                          handleAddMeal({
                            name: item.name,
                            type: "snack",
                            calories: item.calories,
                          })
                        }
                        className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm transition-colors hover:bg-muted"
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
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
