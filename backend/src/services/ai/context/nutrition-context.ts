import type { SerializedProfile } from "../../auth.service"
import { addDays, createSection, formatDate, formatNumber, startOfLocalDay, type ContextPrismaClient } from "./helpers"
import type { ContextSection } from "./types"

type NutritionTotals = {
  calories: number
  carbs: number
  fat: number
  protein: number
}

function emptyTotals(): NutritionTotals {
  return { calories: 0, carbs: 0, fat: 0, protein: 0 }
}

function addTotals(acc: NutritionTotals, meal: { calories: number; carbs: number | null; fat: number | null; protein: number | null }) {
  acc.calories += meal.calories ?? 0
  acc.carbs += meal.carbs ?? 0
  acc.fat += meal.fat ?? 0
  acc.protein += meal.protein ?? 0
}

export async function buildNutritionContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
  now: Date,
): Promise<ContextSection | null> {
  const today = startOfLocalDay(now)
  const fourteenDaysAgo = startOfLocalDay(addDays(now, -13))

  const meals = await db.meal.findMany({
    include: {
      items: {
        select: {
          calories: true,
          foodNameSnapshot: true,
          protein: true,
        },
      },
    },
    orderBy: [{ loggedDate: "desc" }, { type: "asc" }],
    where: {
      loggedDate: { gte: fourteenDaysAgo },
      userId: profile.id,
    },
  })

  const todayMeals = meals.filter((meal) => isSameDateKey(meal.loggedDate, today))
  const todayTotals = todayMeals.reduce((acc, meal) => {
    addTotals(acc, meal)
    return acc
  }, emptyTotals())

  const totalsByDate = new Map<string, NutritionTotals>()
  const mealCountByDate = new Map<string, number>()
  const foodCounts = new Map<string, number>()

  for (const meal of meals) {
    const dateKey = formatDate(meal.loggedDate)
    const totals = totalsByDate.get(dateKey) ?? emptyTotals()
    addTotals(totals, meal)
    totalsByDate.set(dateKey, totals)
    mealCountByDate.set(dateKey, (mealCountByDate.get(dateKey) ?? 0) + 1)

    for (const item of meal.items) {
      const name = item.foodNameSnapshot?.trim()
      if (name) {
        foodCounts.set(name, (foodCounts.get(name) ?? 0) + 1)
      }
    }
  }

  const loggedDays = totalsByDate.size
  const average = Array.from(totalsByDate.values()).reduce((acc, totals) => {
    acc.calories += totals.calories
    acc.protein += totals.protein
    acc.carbs += totals.carbs
    acc.fat += totals.fat
    return acc
  }, emptyTotals())

  if (loggedDays > 0) {
    average.calories /= loggedDays
    average.protein /= loggedDays
    average.carbs /= loggedDays
    average.fat /= loggedDays
  }

  const topFoods = Array.from(foodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count}x)`)

  const remainingCalories = profile.dailyCalorieGoal - todayTotals.calories
  const remainingProtein = profile.dailyProteinGoal - todayTotals.protein
  const lines = [
    todayMeals.length > 0
      ? `- Hôm nay (${formatDate(today)}): ${formatNumber(todayTotals.calories)} / ${profile.dailyCalorieGoal} kcal, P ${formatNumber(todayTotals.protein)}g / C ${formatNumber(todayTotals.carbs)}g / F ${formatNumber(todayTotals.fat)}g.`
      : `- Hôm nay (${formatDate(today)}): chưa log bữa ăn nào.`,
    todayMeals.length > 0
      ? `- Còn lại hôm nay: ${formatNumber(remainingCalories)} kcal, protein ${formatNumber(remainingProtein)}g so với mục tiêu.`
      : "",
    loggedDays > 0
      ? `- Trend 14 ngày: log ${loggedDays}/14 ngày, trung bình ${formatNumber(average.calories)} kcal/ngày, P ${formatNumber(average.protein)}g / C ${formatNumber(average.carbs)}g / F ${formatNumber(average.fat)}g.`
      : "- 14 ngày gần đây chưa có dữ liệu dinh dưỡng.",
    topFoods.length > 0 ? `- Món xuất hiện nhiều: ${topFoods.join(", ")}.` : "",
  ]

  return createSection("nutrition", "NUTRITION", 80, lines)
}

function isSameDateKey(left: Date, right: Date) {
  return formatDate(left) === formatDate(right)
}
