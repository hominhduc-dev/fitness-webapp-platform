import { buildNutrientTargets } from "../../../lib/nutrition/nutrient-targets"
import { addNutrients, NUTRIENT_CODES } from "../../../lib/nutrition/nutrients"
import type { SerializedProfile } from "../../auth.service"
import { loadNutrientCatalog, sumItemNutrients, type DayIntake } from "../../nutrition-intake.service"
import { buildInsightFindings, type Finding } from "../nutrition-insight"
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

function describeRemaining(value: number, unit: string) {
  if (value < 0) return `đã vượt mục tiêu ${formatNumber(Math.abs(value))} ${unit}`
  if (value === 0) return "đã đạt mục tiêu"
  return `còn thiếu ${formatNumber(value)} ${unit} để đạt mục tiêu`
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
          foodId: true,
          foodNameSnapshot: true,
          nutrients: true,
          protein: true,
        },
      },
    },
    orderBy: [{ loggedDate: "desc" }, { type: "asc" }],
    where: {
      loggedDate: { gte: fourteenDaysAgo, lt: addDays(today, 1) },
      userId: profile.id,
    },
  })

  // Older rows and test doubles may not expose status; they are legacy consumed logs.
  const consumedMeals = meals.filter((meal) => meal.status !== "planned")
  const todayMeals = consumedMeals.filter((meal) => isSameDateKey(meal.loggedDate, today))
  const todayTotals = todayMeals.reduce((acc, meal) => {
    addTotals(acc, meal)
    return acc
  }, emptyTotals())

  const totalsByDate = new Map<string, NutritionTotals>()
  const mealCountByDate = new Map<string, number>()
  const foodCounts = new Map<string, number>()

  for (const meal of consumedMeals) {
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
      ? `- Calories: ${describeRemaining(remainingCalories, "kcal")}. Protein (mục tiêu ${profile.dailyProteinGoal}g): ${describeRemaining(remainingProtein, "g")}. Không diễn giải lượng đã vượt thành còn thiếu.`
      : "",
    loggedDays > 0
      ? `- Trend 14 ngày: log ${loggedDays}/14 ngày, trung bình ${formatNumber(average.calories)} kcal/ngày, P ${formatNumber(average.protein)}g / C ${formatNumber(average.carbs)}g / F ${formatNumber(average.fat)}g.`
      : "- 14 ngày gần đây chưa có dữ liệu dinh dưỡng.",
    topFoods.length > 0 ? `- Món xuất hiện nhiều: ${topFoods.join(", ")}.` : "",
    await describeMicronutrients(db, profile, consumedMeals, today),
  ]

  return createSection("nutrition", "NUTRITION", 80, lines)
}

type ContextMeal = {
  loggedDate: Date
  calories: number
  protein: number | null
  items: Array<{ foodId?: string; nutrients?: unknown }>
}

/**
 * One line on micronutrients over the last 7 days, from the same findings the
 * Nutrition Insight uses, so chat and the insight card never disagree.
 */
async function describeMicronutrients(db: ContextPrismaClient, profile: SerializedProfile, meals: ContextMeal[], today: Date) {
  const weekStart = startOfLocalDay(addDays(today, -6))
  const days = new Map<string, DayIntake>()
  for (const meal of meals) {
    if (meal.loggedDate < weekStart) continue
    const date = formatDate(meal.loggedDate)
    const day = days.get(date) ?? { calories: 0, carbs: 0, date, fat: 0, items: 0, itemsWithData: 0, nutrients: {}, protein: 0 }
    const { amounts, coverage } = sumItemNutrients(meal.items.map((item) => ({ foodId: item.foodId ?? "", nutrients: (item.nutrients ?? null) as never })))
    addNutrients(day.nutrients, amounts)
    day.items += coverage.items
    day.itemsWithData += coverage.itemsWithData
    days.set(date, day)
  }

  const logged = [...days.values()].filter((day) => day.items > 0)
  if (!logged.some((day) => day.itemsWithData > 0)) return ""

  try {
    const catalog = await loadNutrientCatalog(db)
    // Each nutrient averages over the days it was measured on, as in getIntakeSummary.
    const average: DayIntake["nutrients"] = {}
    for (const code of NUTRIENT_CODES) {
      const measured = logged.filter((day) => day.nutrients[code] != null)
      if (measured.length > 0) average[code] = measured.reduce((sum, day) => sum + (day.nutrients[code] ?? 0), 0) / measured.length
    }
    const { findings } = buildInsightFindings({
      goals: { calories: profile.dailyCalorieGoal, protein: profile.dailyProteinGoal ?? 140 },
      names: Object.fromEntries(catalog.map((nutrient) => [nutrient.code, { name: nutrient.nameVi, unit: nutrient.unit }])),
      targets: buildNutrientTargets(profile, today),
      today: days.get(formatDate(today)) ?? null,
      week: { average: { calories: 0, nutrients: average, protein: 0 }, days: logged, loggedDays: logged.length },
    })
    const micro = findings.filter((finding) => finding.code !== "calories" && finding.code !== "protein" && finding.status !== "good")
    if (micro.length === 0) return "- Vi chất: không có chất nào thiếu hoặc vượt ngưỡng đáng kể."
    const describe = (finding: Finding) =>
      `${finding.name} ${finding.status === "high" ? "vượt" : "thiếu"} (${formatNumber(finding.amount)}/${formatNumber(finding.target)} ${finding.unit}${finding.scope === "week" ? ", TB 7 ngày" : ", hôm nay"})`
    return `- Vi chất: ${micro.map(describe).join("; ")}.`
  } catch {
    // Micronutrients are a bonus in chat context; never fail the whole section over them.
    return ""
  }
}

function isSameDateKey(left: Date, right: Date) {
  return formatDate(left) === formatDate(right)
}
