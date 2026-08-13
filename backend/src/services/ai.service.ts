import { AIGenerationStatus, AIGenerationType, FoodSource, type Prisma, type ProgramDifficulty } from "@prisma/client"
import { randomUUID } from "crypto"

import { getAIProvider } from "../lib/ai/ai-client"
import type { AIConversationMessage } from "../lib/ai/types"
import { prisma, retryTransaction } from "../lib/prisma"
import { chatTools, CREATE_WORKOUT_PROGRAM, normalizeCreateProgramArgs } from "./ai/chat-tools"
import { buildTraineeChatContext } from "./ai/context/builder"
import { parseExerciseSnapshot } from "./ai/context/helpers"
import { selectCatalogForPrompt } from "./ai/exercise-catalog"
import { buildAIChatSystemPrompt } from "./ai/context/prompt"
import type { ChatMessage } from "./ai/context/types"
import { AuthServiceError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { addMealItemForUser, calculateItemNutrition, normalizeAmountUnit, type AmountUnit } from "./nutrition.service"
import { roundNutrition } from "../lib/nutrition/food-utils"

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

const DAILY_LIMITS: Record<AIGenerationType, number> = {
  workout_program: 5,
  meal_plan: 10,
}

async function checkRateLimit(userId: string, type: AIGenerationType) {
  const db = ensurePrisma()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const count = await db.aIGeneration.count({
    where: {
      userId,
      type,
      createdAt: { gte: startOfDay },
    },
  })

  if (count >= DAILY_LIMITS[type]) {
    throw new AuthServiceError(
      `Bạn đã đạt giới hạn ${DAILY_LIMITS[type]} lần tạo AI mỗi ngày. Vui lòng thử lại vào ngày mai.`,
      429,
    )
  }
}

// Chat is lightweight and high-frequency, so it isn't persisted as an
// AIGeneration row. Limit it with an in-memory per-user daily counter (fine for
// a single backend instance; resets on restart). Prevents the chat box from
// being abused as a free general-purpose assistant.
const DAILY_CHAT_LIMIT = 40
const chatUsage = new Map<string, { date: string; count: number }>()

function checkChatRateLimit(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const entry = chatUsage.get(userId)

  if (!entry || entry.date !== today) {
    chatUsage.set(userId, { date: today, count: 1 })
    return
  }

  if (entry.count >= DAILY_CHAT_LIMIT) {
    throw new AuthServiceError(
      `Bạn đã đạt giới hạn ${DAILY_CHAT_LIMIT} tin nhắn AI mỗi ngày. Vui lòng thử lại vào ngày mai.`,
      429,
    )
  }

  entry.count += 1
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database connection not available.", 500)
  }
  return prisma
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

// ---------------------------------------------------------------------------
// Exercise Mapping
// ---------------------------------------------------------------------------

type ExerciseCatalogItem = {
  id: string
  name: string
  muscleGroup: string
  variations: Array<{
    id: string
    name: string
    equipment: string | null
  }>
}

function mapExerciseToVariation(
  exerciseName: string,
  variationName: string | undefined,
  catalog: ExerciseCatalogItem[],
): string | null {
  const normExercise = normalizeForMatch(exerciseName)
  const normVariation = variationName ? normalizeForMatch(variationName) : null

  const exercise = catalog.find((e) => normalizeForMatch(e.name) === normExercise)

  if (!exercise) {
    return null
  }

  if (normVariation && exercise.variations.length > 0) {
    const variation = exercise.variations.find((v) => normalizeForMatch(v.name) === normVariation)
    if (variation) {
      return variation.id
    }
  }

  const defaultVariation = exercise.variations.find((v) =>
    normalizeForMatch(v.name) === "default" || exercise.variations.indexOf(v) === 0,
  )
  return defaultVariation?.id ?? null
}

// ---------------------------------------------------------------------------
// Food Mapping
// ---------------------------------------------------------------------------

type FoodCatalogItem = {
  id: string
  name: string
  category: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sodium: number | null
  sugar: number | null
  servingLabel: string
  servingAmount: number
  servingUnit: string
}

function mapFoodToId(
  foodName: string,
  catalog: FoodCatalogItem[],
): string | null {
  const normName = normalizeForMatch(foodName)
  const food = catalog.find((f) => normalizeForMatch(f.name) === normName)
  return food?.id ?? null
}

// addMealItemForUser rejects non-positive amounts and anything above 5000, and
// acceptAIMealPlan swallows those failures. Drop them at generation time instead
// so the preview only ever shows items that will really be logged.
const MAX_MEAL_AMOUNT = 5000

function normalizeAmountValue(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MEAL_AMOUNT) {
    return null
  }
  return amount
}

// ---------------------------------------------------------------------------
// Workout Program Generation
// ---------------------------------------------------------------------------

type GenerateProgramInput = {
  goal: string
  experienceLevel: string
  daysPerWeek: number
  sessionDuration: number
  availableEquipment: string
  focusAreas?: string[]
  injuries?: string
  durationWeeks: number
}

type AIWorkoutOutput = {
  name: string
  description: string
  workouts: Array<{
    name: string
    kind: string
    weekIndex: number
    scheduledDay: number
    duration: number
    exercises: Array<{
      exerciseName: string
      variationName?: string
      sets: number
      reps: number
      repsMin?: number
      rir?: number
      restTime?: number
      weight?: number
    }>
  }>
}

const GOAL_LABELS: Record<string, string> = {
  build_muscle: "Tăng cơ bắp",
  lose_weight: "Giảm cân",
  strength: "Tăng sức mạnh",
  endurance: "Tăng sức bền",
  general_fitness: "Thể lực tổng hợp",
}

const EQUIPMENT_LABELS: Record<string, string> = {
  full_gym: "Phòng gym đầy đủ thiết bị",
  home_dumbbells: "Tạ đôi tại nhà",
  bodyweight: "Tập với trọng lượng cơ thể",
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Người mới bắt đầu",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
}

async function generateWorkoutProgram(profile: SerializedProfile, input: GenerateProgramInput) {
  const db = ensurePrisma()
  await checkRateLimit(profile.id, AIGenerationType.workout_program)

  if (input.daysPerWeek < 2 || input.daysPerWeek > 7) {
    throw new AuthServiceError("Số buổi tập mỗi tuần phải từ 2 đến 7.", 400)
  }
  if (input.durationWeeks < 1 || input.durationWeeks > 16) {
    throw new AuthServiceError("Thời gian chương trình phải từ 1 đến 16 tuần.", 400)
  }

  const exercises = await db.exercise.findMany({
    include: {
      variations: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    where: {
      OR: [
        { createdById: null },
        { createdById: profile.id },
      ],
    },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })

  const catalog: ExerciseCatalogItem[] = exercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    variations: e.variations.map((v) => ({
      id: v.id,
      name: v.name,
      equipment: v.equipment,
    })),
  }))

  const recentLogs = await db.workoutLog.findMany({
    where: {
      userId: profile.id,
      startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  })

  const recentExerciseNames = recentLogs.flatMap((log) =>
    parseExerciseSnapshot(log.exerciseSnapshot)
      .map((entry) => entry.exercise?.name?.trim())
      .filter((name): name is string => Boolean(name)),
  )

  const catalogForPrompt = selectCatalogForPrompt(
    exercises.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      createdById: e.createdById,
      variations: e.variations.map((v) => ({ id: v.id, name: v.name, equipment: v.equipment })),
    })),
    {
      availableEquipment: input.availableEquipment,
      focusAreas: input.focusAreas,
      recentExerciseNames,
    },
  )

  const systemPrompt = `Bạn là một personal trainer AI chuyên nghiệp. Tạo chương trình tập luyện cá nhân hoá dựa trên thông tin người dùng.

QUY TẮC BẮT BUỘC:
1. CHỈ sử dụng bài tập từ Exercise Catalog được cung cấp. KHÔNG tự nghĩ ra bài tập mới.
2. exerciseName và variationName PHẢI khớp chính xác với tên trong catalog.
3. Trả về JSON thuần tuý, KHÔNG wrap trong markdown code block.
4. weekIndex bắt đầu từ 0, scheduledDay: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7.
5. kind phải là một trong: push, pull, legs, full_body, cardio, other.
6. Chỉ tạo lịch cho tuần đầu tiên (weekIndex=0). Các tuần sau sẽ lặp lại.`

  const weightInfo = profile.targetWeightKg
    ? `Cân nặng mục tiêu: ${profile.targetWeightKg}kg`
    : ""
  const heightInfo = profile.heightCm ? `Chiều cao: ${profile.heightCm}cm` : ""

  const userPrompt = `## Thông tin người dùng
- Mục tiêu: ${GOAL_LABELS[input.goal] ?? input.goal}
- Trình độ: ${LEVEL_LABELS[input.experienceLevel] ?? input.experienceLevel}
- ${heightInfo} ${weightInfo}
- Số buổi/tuần: ${input.daysPerWeek}
- Thời lượng mỗi buổi: ${input.sessionDuration} phút
- Thiết bị: ${EQUIPMENT_LABELS[input.availableEquipment] ?? input.availableEquipment}
${input.focusAreas?.length ? `- Vùng tập trung: ${input.focusAreas.join(", ")}` : ""}
${input.injuries ? `- Chấn thương/hạn chế: ${input.injuries}` : ""}
- Thời gian chương trình: ${input.durationWeeks} tuần

## Lịch sử tập (30 ngày qua)
- Số buổi đã tập: ${recentLogs.length}

## Exercise Catalog (CHỈ dùng exercises trong list này)
${JSON.stringify(catalogForPrompt, null, 0)}

## Output JSON Schema
{
  "name": "string - tên chương trình bằng tiếng Việt",
  "description": "string - mô tả ngắn bằng tiếng Việt",
  "workouts": [{
    "name": "string - tên buổi tập",
    "kind": "push|pull|legs|full_body|cardio|other",
    "weekIndex": 0,
    "scheduledDay": "number 0-6",
    "duration": "number - phút",
    "exercises": [{
      "exerciseName": "string - tên chính xác từ catalog",
      "variationName": "string - tên variation từ catalog",
      "sets": "number",
      "reps": "number",
      "repsMin": "number (optional)",
      "rir": "number (optional, 0-4)",
      "restTime": "number giây (optional)",
      "weight": "number kg (optional)"
    }]
  }]
}`

  const generation = await db.aIGeneration.create({
    data: {
      id: randomUUID(),
      userId: profile.id,
      type: AIGenerationType.workout_program,
      status: AIGenerationStatus.pending,
      input: input as unknown as Prisma.InputJsonValue,
    },
  })

  try {
    const ai = getAIProvider()
    const response = await ai.generateStructuredJSON<AIWorkoutOutput>({
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
    })

    const aiOutput = response.data

    const mappedWorkouts = aiOutput.workouts.map((workout) => {
      const mappedExercises = workout.exercises
        .map((exercise) => {
          const variationId = mapExerciseToVariation(exercise.exerciseName, exercise.variationName, catalog)
          if (!variationId) return null
          return {
            variationId,
            sets: exercise.sets,
            reps: exercise.reps,
            repsMin: exercise.repsMin,
            rir: exercise.rir,
            restTime: exercise.restTime,
            weight: exercise.weight,
          }
        })
        .filter(Boolean) as Array<{
          variationId: string
          sets: number
          reps: number
          repsMin?: number
          rir?: number
          restTime?: number
          weight?: number
        }>

      return {
        name: workout.name,
        kind: workout.kind,
        weekIndex: workout.weekIndex,
        scheduledDay: workout.scheduledDay,
        duration: workout.duration,
        exercises: mappedExercises,
      }
    })

    const totalExercises = aiOutput.workouts.reduce((sum, w) => sum + w.exercises.length, 0)
    const mappedExercises = mappedWorkouts.reduce((sum, w) => sum + w.exercises.length, 0)
    const mappingRate = totalExercises > 0 ? mappedExercises / totalExercises : 0

    if (mappingRate < 0.7) {
      await db.aIGeneration.update({
        where: { id: generation.id },
        data: {
          status: AIGenerationStatus.failed,
          output: aiOutput as unknown as Prisma.InputJsonValue,
          tokenUsage: response.tokenUsage,
          errorMsg: `Chỉ map được ${Math.round(mappingRate * 100)}% bài tập. Vui lòng thử lại.`,
        },
      })
      throw new AuthServiceError(
        "AI đã tạo chương trình nhưng nhiều bài tập không khớp với thư viện. Vui lòng thử lại.",
        422,
      )
    }

    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.completed,
        output: {
          raw: aiOutput,
          mapped: {
            name: aiOutput.name,
            description: aiOutput.description,
            difficulty: mapDifficulty(input.experienceLevel),
            duration: input.durationWeeks,
            workoutsPerWeek: input.daysPerWeek,
            workouts: mappedWorkouts,
          },
        } as unknown as Prisma.InputJsonValue,
        tokenUsage: response.tokenUsage,
      },
    })

    return {
      generationId: generation.id,
      program: {
        name: aiOutput.name,
        description: aiOutput.description,
        difficulty: mapDifficulty(input.experienceLevel),
        duration: input.durationWeeks,
        workoutsPerWeek: input.daysPerWeek,
        workouts: mappedWorkouts,
      },
      mappingRate: Math.round(mappingRate * 100),
    }
  } catch (error) {
    if (error instanceof AuthServiceError) throw error

    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.failed,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
      },
    })
    throw new AuthServiceError("Không thể tạo chương trình AI. Vui lòng thử lại sau.", 500)
  }
}

function mapDifficulty(level: string): ProgramDifficulty {
  if (level === "beginner") return "beginner"
  if (level === "advanced") return "advanced"
  return "intermediate"
}

// ---------------------------------------------------------------------------
// Accept Program — persist to DB as real Program
// ---------------------------------------------------------------------------

async function acceptAIProgram(profile: SerializedProfile, generationId: string) {
  const db = ensurePrisma()

  const generation = await db.aIGeneration.findUnique({
    where: { id: generationId },
  })

  if (!generation || generation.userId !== profile.id) {
    throw new AuthServiceError("Không tìm thấy kết quả AI.", 404)
  }

  if (generation.status !== AIGenerationStatus.completed) {
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", 400)
  }

  const output = generation.output as { mapped: MappedProgramOutput } | null
  if (!output?.mapped) {
    throw new AuthServiceError("Dữ liệu chương trình AI không hợp lệ.", 400)
  }

  const mapped = output.mapped

  const program = await retryTransaction(() =>
    db.$transaction(async (tx) => {
      const programId = randomUUID()

      await tx.program.create({
        data: {
          id: programId,
          name: mapped.name,
          description: mapped.description,
          difficulty: mapped.difficulty,
          duration: mapped.duration,
          workoutsPerWeek: mapped.workoutsPerWeek,
          isAIGenerated: true,
          createdById: profile.id,
        },
      })

      await tx.programAssignment.create({
        data: {
          programId,
          userId: profile.id,
        },
      })

      for (const workout of mapped.workouts) {
        const workoutId = randomUUID()

        await tx.workout.create({
          data: {
            id: workoutId,
            programId,
            name: workout.name,
            scheduledDay: workout.scheduledDay,
            weekIndex: workout.weekIndex,
            duration: workout.duration,
          },
        })

        for (let i = 0; i < workout.exercises.length; i++) {
          const exercise = workout.exercises[i]
          const workoutExerciseId = randomUUID()

          await tx.workoutExercise.create({
            data: {
              id: workoutExerciseId,
              workoutId,
              variationId: exercise.variationId,
              order: i + 1,
              restTime: exercise.restTime,
            },
          })

          const setCount = Math.max(1, Math.round(exercise.sets))
          await tx.exerciseSet.createMany({
            data: Array.from({ length: setCount }, (_, setIndex) => ({
              id: randomUUID(),
              workoutExerciseId,
              setNumber: setIndex + 1,
              targetReps: exercise.reps,
              targetRepsMin: exercise.repsMin,
              weight: exercise.weight,
              rir: exercise.rir,
            })),
          })
        }
      }

      await tx.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: AIGenerationStatus.accepted,
          programId,
        },
      })

      return tx.program.findUniqueOrThrow({
        where: { id: programId },
        include: {
          workouts: {
            include: {
              exercises: {
                include: {
                  variation: {
                    include: { exercise: true },
                  },
                  sets: { orderBy: { setNumber: "asc" } },
                },
                orderBy: { order: "asc" },
              },
            },
            orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }],
          },
          assignments: true,
        },
      })
    }, {
      maxWait: 15000,
      timeout: 60000,
    }),
  )

  return program
}

type MappedProgramOutput = {
  name: string
  description: string
  difficulty: ProgramDifficulty
  duration: number
  workoutsPerWeek: number
  workouts: Array<{
    name: string
    kind: string
    weekIndex: number
    scheduledDay: number
    duration: number
    exercises: Array<{
      variationId: string
      sets: number
      reps: number
      repsMin?: number
      rir?: number
      restTime?: number
      weight?: number
    }>
  }>
}

// ---------------------------------------------------------------------------
// Meal Plan Generation
// ---------------------------------------------------------------------------

type GenerateMealPlanInput = {
  date: string
  preferences?: string
  budget?: string
  cookingTime?: string
}

type AIMealPlanOutput = {
  meals: Array<{
    type: "breakfast" | "lunch" | "dinner" | "snack"
    suggestion: string
    items: Array<{
      foodName: string
      amountValue: number
      amountUnit: "serving" | "g" | "ml"
    }>
  }>
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  notes: string
}

const BUDGET_LABELS: Record<string, string> = {
  low: "Tiết kiệm",
  medium: "Trung bình",
  high: "Không giới hạn",
}

const COOKING_TIME_LABELS: Record<string, string> = {
  quick: "Nhanh (15-20 phút)",
  normal: "Bình thường (30-60 phút)",
}

async function generateMealPlan(profile: SerializedProfile, input: GenerateMealPlanInput) {
  const db = ensurePrisma()
  await checkRateLimit(profile.id, AIGenerationType.meal_plan)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new AuthServiceError("Ngày không hợp lệ. Định dạng: YYYY-MM-DD.", 400)
  }

  const foods = await db.food.findMany({
    where: {
      OR: [
        { source: FoodSource.system },
        { createdById: profile.id, source: FoodSource.user },
      ],
    },
    orderBy: { name: "asc" },
  })

  const foodCatalog: FoodCatalogItem[] = foods.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    calories: f.calories ?? 0,
    protein: f.protein ?? 0,
    carbs: f.carbs ?? 0,
    fat: f.fat ?? 0,
    fiber: f.fiber,
    sodium: f.sodium,
    sugar: f.sugar,
    servingLabel: f.servingLabel,
    servingAmount: f.servingAmount ?? 1,
    servingUnit: f.servingUnit,
  }))

  const recentMeals = await db.meal.findMany({
    where: {
      userId: profile.id,
      loggedDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      items: {
        include: { food: { select: { name: true } } },
      },
    },
    orderBy: { loggedDate: "desc" },
    take: 20,
  })

  const recentFoodNames = Array.from(
    new Set(recentMeals.flatMap((m) => m.items.map((i) => i.food?.name ?? i.foodNameSnapshot))),
  ).slice(0, 15)

  const catalogForPrompt = foodCatalog.map((f) => ({
    name: f.name,
    category: f.category,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    servingLabel: f.servingLabel,
  }))

  const systemPrompt = `Bạn là chuyên gia dinh dưỡng AI. Tạo thực đơn 1 ngày phù hợp với mục tiêu dinh dưỡng và ẩm thực Việt Nam.

QUY TẮC BẮT BUỘC:
1. CHỈ sử dụng foods từ Food Catalog được cung cấp. KHÔNG tự nghĩ ra món mới.
2. foodName PHẢI khớp chính xác với tên trong catalog.
3. Trả về JSON thuần tuý, KHÔNG wrap trong markdown code block.
4. type phải là: breakfast, lunch, dinner, hoặc snack.
5. Tổng calories phải gần với mục tiêu (±10%).
6. Tạo đúng 4 bữa: breakfast, lunch, dinner, snack.
7. Mỗi bữa chỉ có 2-3 items. Dùng amountValue để tăng khẩu phần thay vì thêm quá nhiều món.
8. amountUnit CHỈ được là "serving", "g" hoặc "ml". TUYỆT ĐỐI không dùng đơn vị khác (ly, tô, dĩa, quả, chén, muỗng...) — dùng "serving" cho khẩu phần và đặt số lượng vào amountValue.
9. Không giải thích, không tính toán từng bước, không dùng thẻ <thought>/<thinking>.
10. JSON phải bắt đầu ngay bằng ký tự { và kết thúc bằng }.`

  const userPrompt = `## Mục tiêu dinh dưỡng
- Calories: ${profile.dailyCalorieGoal} kcal
- Protein: ${profile.dailyProteinGoal ?? 140}g
- Carbs: ${profile.dailyCarbsGoal ?? 280}g
- Fat: ${profile.dailyFatGoal ?? 70}g

${input.preferences ? `## Sở thích / hạn chế: ${input.preferences}` : ""}
## Ngân sách: ${BUDGET_LABELS[input.budget ?? "medium"] ?? "Trung bình"}
## Thời gian nấu: ${COOKING_TIME_LABELS[input.cookingTime ?? "normal"] ?? "Bình thường"}

## Bữa ăn gần đây (tránh lặp)
${recentFoodNames.length > 0 ? recentFoodNames.join(", ") : "Chưa có dữ liệu"}

## Food Catalog (CHỈ dùng foods trong list này)
${JSON.stringify(catalogForPrompt, null, 0)}

## Output JSON Shape
{
  "meals": [{
    "type": "breakfast",
    "suggestion": "mô tả ngắn bữa ăn",
    "items": [{
      "foodName": "tên chính xác từ catalog",
      "amountValue": 1,
      "amountUnit": "serving"
    }]
  }],
  "totalCalories": 2500,
  "totalProtein": 150,
  "totalCarbs": 280,
  "totalFat": 70,
  "notes": "ghi chú dinh dưỡng ngắn bằng tiếng Việt"
}`

  const generation = await db.aIGeneration.create({
    data: {
      id: randomUUID(),
      userId: profile.id,
      type: AIGenerationType.meal_plan,
      status: AIGenerationStatus.pending,
      input: input as unknown as Prisma.InputJsonValue,
    },
  })

  try {
    const ai = getAIProvider()
    const response = await ai.generateStructuredJSON<AIMealPlanOutput>({
      systemPrompt,
      userPrompt,
      // A full-day plan (4 meals + items + totals + notes) easily exceeds 2048
      // output tokens and gets truncated mid-JSON, so allow more headroom.
      maxTokens: 4096,
    })

    const aiOutput = response.data

    const mappedMeals = aiOutput.meals.map((meal) => {
      const mappedItems = meal.items
        .map((item) => {
          const foodId = mapFoodToId(item.foodName, foodCatalog)
          if (!foodId) return null
          const food = foodCatalog.find((f) => f.id === foodId)
          if (!food) return null

          const amountValue = normalizeAmountValue(item.amountValue)
          if (amountValue === null) return null

          // Models routinely invent units ("ly", "tô", "100 g"), so normalize
          // here and scale with the exact same helper the accept path uses —
          // otherwise the preview totals disagree with what actually gets logged.
          const amountUnit = normalizeAmountUnit(item.amountUnit)
          const nutrition = calculateItemNutrition(food, { amountUnit, amountValue })

          return {
            foodId,
            foodName: food.name,
            amountValue,
            amountUnit,
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
          }
        })
        .filter(Boolean) as Array<{
          foodId: string
          foodName: string
          amountValue: number
          amountUnit: AmountUnit
          calories: number
          protein: number
          carbs: number
          fat: number
        }>

      return {
        type: meal.type,
        suggestion: meal.suggestion,
        items: mappedItems,
      }
    })

    // Totals come from the mapped items, not from the model's own arithmetic —
    // the model can't know which items dropped out of the catalog mapping, and
    // its self-reported sums were drifting from the logged values.
    const totals = mappedMeals.reduce(
      (acc, meal) => {
        for (const item of meal.items) {
          acc.calories += item.calories
          acc.protein += item.protein
          acc.carbs += item.carbs
          acc.fat += item.fat
        }
        return acc
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )

    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.completed,
        output: {
          raw: aiOutput,
          mapped: mappedMeals,
        } as unknown as unknown as Prisma.InputJsonValue,
        tokenUsage: response.tokenUsage,
      },
    })

    return {
      generationId: generation.id,
      meals: mappedMeals,
      totals: {
        calories: roundNutrition(totals.calories),
        protein: roundNutrition(totals.protein),
        carbs: roundNutrition(totals.carbs),
        fat: roundNutrition(totals.fat),
      },
      notes: aiOutput.notes,
    }
  } catch (error) {
    if (error instanceof AuthServiceError) throw error

    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.failed,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
      },
    })
    throw new AuthServiceError("Không thể tạo thực đơn AI. Vui lòng thử lại sau.", 500)
  }
}

// ---------------------------------------------------------------------------
// Accept Meal Plan — log items to existing meal system
// ---------------------------------------------------------------------------

async function acceptAIMealPlan(profile: SerializedProfile, generationId: string, date: string) {
  const db = ensurePrisma()

  const generation = await db.aIGeneration.findUnique({
    where: { id: generationId },
  })

  if (!generation || generation.userId !== profile.id) {
    throw new AuthServiceError("Không tìm thấy kết quả AI.", 404)
  }

  if (generation.status !== AIGenerationStatus.completed) {
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", 400)
  }

  const output = generation.output as { mapped: MappedMealOutput[] } | null
  if (!output?.mapped) {
    throw new AuthServiceError("Dữ liệu thực đơn AI không hợp lệ.", 400)
  }

  for (const meal of output.mapped) {
    for (const item of meal.items) {
      try {
        await addMealItemForUser(profile, {
          date,
          mealType: meal.type,
          foodId: item.foodId,
          amountValue: item.amountValue,
          amountUnit: item.amountUnit,
        })
      } catch {
        // skip items that fail to add (e.g. food deleted since generation)
      }
    }
  }

  await db.aIGeneration.update({
    where: { id: generationId },
    data: { status: AIGenerationStatus.accepted },
  })

  return { accepted: true }
}

type MappedMealOutput = {
  type: string
  suggestion: string
  items: Array<{
    foodId: string
    foodName: string
    amountValue: number
    amountUnit: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }>
}

// ---------------------------------------------------------------------------
// AI Chat — one-shot fitness Q&A
// ---------------------------------------------------------------------------

const FALLBACK_REPLY = "Mình là AI Coach, chỉ hỗ trợ về tập luyện, dinh dưỡng và sức khoẻ thôi nhé! 💪"

/** A draft the chat produced that the user still has to confirm. */
type ChatAction = {
  type: "program_draft"
  generationId: string
  mappingRate: number
  program: MappedProgramOutput
}

async function chatWithAI(
  profile: SerializedProfile,
  message: string,
  history: ChatMessage[],
): Promise<{ reply: string; action?: ChatAction }> {
  if (!message.trim()) {
    throw new AuthServiceError("Tin nhắn không được để trống.", 400)
  }

  if (message.length > 2000) {
    throw new AuthServiceError("Tin nhắn quá dài (tối đa 2000 ký tự).", 400)
  }

  checkChatRateLimit(profile.id)

  let systemPrompt: string
  try {
    const chatContext = await buildTraineeChatContext({ history, message, profile })
    systemPrompt = buildAIChatSystemPrompt(profile, chatContext)
  } catch {
    // Never let context building break chat — fall back to generic advice.
    systemPrompt = buildAIChatSystemPrompt(profile, null)
  }

  const ai = getAIProvider()
  const conversationHistory = history.slice(-6)

  if (!ai.supportsTools) {
    const userPrompt = conversationHistory.length > 0
      ? conversationHistory.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n") + `\nUser: ${message}`
      : message

    const response = await ai.generateText({ systemPrompt, userPrompt, maxTokens: 1024 })
    return { reply: response.data.trim() || FALLBACK_REPLY }
  }

  const messages: AIConversationMessage[] = [
    ...conversationHistory.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: "user" as const, content: message },
  ]

  const turn = await ai.generateWithTools({
    systemPrompt,
    messages,
    tools: chatTools,
    maxTokens: 1024,
  })

  if (turn.toolCalls.length === 0) {
    return { reply: turn.text.trim() || FALLBACK_REPLY }
  }

  // Every tool call must get a result back or the next request is rejected, so
  // walk all of them — but only ever run one generation per message, since each
  // one is slow, token-heavy and counts against the daily program quota.
  let action: ChatAction | undefined
  const toolResults: AIConversationMessage[] = []

  for (const call of turn.toolCalls) {
    if (call.name !== CREATE_WORKOUT_PROGRAM) {
      toolResults.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify({ ok: false, error: `Tool "${call.name}" không tồn tại.` }),
      })
      continue
    }

    if (action) {
      toolResults.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify({ ok: false, error: "Đã tạo một chương trình trong lượt này rồi." }),
      })
      continue
    }

    try {
      const input = normalizeCreateProgramArgs(call.arguments)
      const result = await generateWorkoutProgram(profile, input)
      action = {
        type: "program_draft",
        generationId: result.generationId,
        mappingRate: result.mappingRate,
        program: result.program as MappedProgramOutput,
      }
      // Keep the tool result small — the model only needs enough to describe the
      // draft, and the full payload goes to the client through `action`.
      toolResults.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify({
          ok: true,
          name: result.program.name,
          description: result.program.description,
          durationWeeks: result.program.duration,
          workoutsPerWeek: result.program.workoutsPerWeek,
          mappingRate: result.mappingRate,
          workouts: result.program.workouts.map((workout) => ({
            name: workout.name,
            scheduledDay: workout.scheduledDay,
            exerciseCount: workout.exercises.length,
          })),
          note: "Đây là bản nháp. Trainee phải bấm xác nhận trong app thì mới được lưu.",
        }),
      })
    } catch (error) {
      toolResults.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify({
          ok: false,
          error: error instanceof AuthServiceError ? error.message : "Không tạo được chương trình.",
        }),
      })
    }
  }

  const followUp = await ai.generateWithTools({
    systemPrompt,
    messages: [
      ...messages,
      { role: "assistant", content: turn.text, toolCalls: turn.toolCalls },
      ...toolResults,
    ],
    tools: chatTools,
    maxTokens: 1024,
  })

  const reply = followUp.text.trim() || turn.text.trim() || FALLBACK_REPLY
  return action ? { reply, action } : { reply }
}

export {
  acceptAIMealPlan,
  acceptAIProgram,
  chatWithAI,
  generateMealPlan,
  generateWorkoutProgram,
}
