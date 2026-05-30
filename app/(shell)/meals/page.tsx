import { MealsClient, type MealsClientInitialData } from "@/components/meals/meals-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchMealHistory, fetchMeals } from "@/lib/fitness/api"

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export default async function MealsPage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const selectedDateKey = formatDateKey(new Date())
  const [mealCollection, mealHistory] = await Promise.all([
    fetchMeals(accessToken, selectedDateKey),
    fetchMealHistory(accessToken, { limit: 12 }),
  ])
  const initialData: MealsClientInitialData = {
    mealHistory,
    selectedDateKey,
    meals: mealCollection.meals,
    targetCalories: mealCollection.dailyNutrition.targetCalories,
    weeklyCalories: mealCollection.weeklyCalories,
  }

  return <MealsClient initialData={initialData} />
}
