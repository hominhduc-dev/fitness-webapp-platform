import { MealsClient, type MealsClientInitialData } from "@/components/meals/meals-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchFoods, fetchNutritionDay } from "@/lib/fitness/api"

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export default async function MealsPage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const selectedDateKey = formatDateKey(new Date())
  const [nutritionDay, foods] = await Promise.all([
    fetchNutritionDay(accessToken, selectedDateKey),
    fetchFoods(accessToken),
  ])
  const initialData: MealsClientInitialData = {
    foods,
    nutritionDay,
    selectedDateKey,
  }

  return <MealsClient initialData={initialData} />
}
