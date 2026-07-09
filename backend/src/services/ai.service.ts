import { AIGenerationStatus, AIGenerationType, FoodSource, type Prisma, type ProgramDifficulty } from "@prisma/client"
import { randomUUID } from "crypto"

import { getAIProvider } from "../lib/ai/ai-client"
import { prisma, retryTransaction } from "../lib/prisma"
import { AuthServiceError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { addMealItemForUser } from "./nutrition.service"

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
  servingLabel: string | null
  servingAmount: number
  servingUnit: string | null
}

function mapFoodToId(
  foodName: string,
  catalog: FoodCatalogItem[],
): string | null {
  const normName = normalizeForMatch(foodName)
  const food = catalog.find((f) => normalizeForMatch(f.name) === normName)
  return food?.id ?? null
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

  const catalogForPrompt = catalog.map((e) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    variations: e.variations.map((v) => v.name),
  }))

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
8. Không giải thích, không tính toán từng bước, không dùng thẻ <thought>/<thinking>.
9. JSON phải bắt đầu ngay bằng ký tự { và kết thúc bằng }.`

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
          return {
            foodId,
            foodName: food?.name ?? item.foodName,
            amountValue: item.amountValue,
            amountUnit: item.amountUnit,
            calories: food?.calories ?? 0,
            protein: food?.protein ?? 0,
            carbs: food?.carbs ?? 0,
            fat: food?.fat ?? 0,
          }
        })
        .filter(Boolean) as Array<{
          foodId: string
          foodName: string
          amountValue: number
          amountUnit: string
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
        calories: aiOutput.totalCalories,
        protein: aiOutput.totalProtein,
        carbs: aiOutput.totalCarbs,
        fat: aiOutput.totalFat,
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

type ChatMessage = { role: "user" | "assistant"; content: string }

// Build a compact snapshot of the trainee's recent activity so the chat can
// answer "how am I doing?" questions with real data (weight trend, today's
// macros, weekly training load, per-exercise progression) instead of guessing.
async function buildChatContext(profile: SerializedProfile): Promise<string> {
  const db = ensurePrisma()
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [latestBodyMetric, previousBodyMetric, todayMeals, weekLogs, recentSets] = await Promise.all([
    db.bodyMetricEntry.findFirst({
      where: { traineeId: profile.id, weightKg: { not: null } },
      orderBy: { recordedAt: "desc" },
    }),
    db.bodyMetricEntry.findFirst({
      where: {
        traineeId: profile.id,
        weightKg: { not: null },
        recordedAt: { lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { recordedAt: "desc" },
    }),
    db.meal.findMany({
      where: { userId: profile.id, loggedDate: { gte: startOfDay } },
      select: { calories: true, protein: true, carbs: true, fat: true },
    }),
    db.workoutLog.findMany({
      where: { userId: profile.id, startedAt: { gte: startOfWeek } },
      select: { totalVolume: true, completedAt: true },
    }),
    db.exerciseSet.findMany({
      where: {
        completed: true,
        weight: { not: null },
        workoutExercise: {
          workout: {
            logs: {
              some: { userId: profile.id, startedAt: { gte: thirtyDaysAgo } },
            },
          },
        },
      },
      select: {
        weight: true,
        actualReps: true,
        targetReps: true,
        workoutExercise: {
          select: {
            variation: {
              select: { name: true, exercise: { select: { name: true } } },
            },
            workout: {
              select: {
                logs: {
                  where: { userId: profile.id },
                  select: { startedAt: true },
                  orderBy: { startedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      take: 300,
    }),
  ])

  const lines: string[] = []

  // Body metrics
  const currentWeight = latestBodyMetric?.weightKg
  const target = profile.targetWeightKg
  if (currentWeight != null) {
    const parts = [`- Cân nặng hiện tại: ${currentWeight.toFixed(1)}kg`]
    if (target != null) {
      const diff = currentWeight - target
      const direction = diff > 0 ? `còn ${diff.toFixed(1)}kg để giảm` : diff < 0 ? `dưới mục tiêu ${Math.abs(diff).toFixed(1)}kg` : "đúng mục tiêu"
      parts.push(`mục tiêu ${target}kg (${direction})`)
    }
    const prevWeight = previousBodyMetric?.weightKg
    if (prevWeight != null && previousBodyMetric) {
      const delta = currentWeight - prevWeight
      const sign = delta > 0 ? "+" : ""
      const days = Math.round((now.getTime() - previousBodyMetric.recordedAt.getTime()) / (24 * 60 * 60 * 1000))
      parts.push(`thay đổi ${sign}${delta.toFixed(1)}kg trong ${days} ngày qua`)
    }
    lines.push(parts.join(", "))
  } else if (target != null) {
    lines.push(`- Cân nặng mục tiêu: ${target}kg (chưa có dữ liệu cân nặng hiện tại)`)
  }

  // Today's nutrition
  if (todayMeals.length > 0) {
    const totals = todayMeals.reduce<{ calories: number; protein: number; carbs: number; fat: number }>(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
    const goal = profile.dailyCalorieGoal
    const pct = goal ? Math.round((totals.calories / goal) * 100) : null
    lines.push(
      `- Đã ăn hôm nay: ${Math.round(totals.calories)} kcal${pct != null ? ` (${pct}% mục tiêu ${goal})` : ""}, ` +
        `P ${Math.round(totals.protein)}g / C ${Math.round(totals.carbs)}g / F ${Math.round(totals.fat)}g`,
    )
  } else {
    lines.push(`- Hôm nay chưa log bữa ăn nào`)
  }

  // Weekly training
  const completedWeekLogs = weekLogs.filter((l) => l.completedAt != null)
  if (completedWeekLogs.length > 0) {
    const totalVolume = completedWeekLogs.reduce((sum, l) => sum + (l.totalVolume ?? 0), 0)
    lines.push(`- Tuần này: ${completedWeekLogs.length} buổi hoàn thành, tổng volume ${Math.round(totalVolume)}kg`)
  } else {
    lines.push(`- Tuần này chưa hoàn thành buổi tập nào`)
  }

  // Progression per exercise (top 5 by frequency)
  type SetEntry = { weight: number; reps: number; startedAt: Date }
  const byExercise = new Map<string, SetEntry[]>()
  for (const set of recentSets) {
    const exName = set.workoutExercise?.variation?.exercise?.name
    const varName = set.workoutExercise?.variation?.name
    const startedAt = set.workoutExercise?.workout?.logs[0]?.startedAt
    if (!exName || set.weight == null || !startedAt) continue
    const key = varName && varName.toLowerCase() !== "default" ? `${exName} (${varName})` : exName
    const list = byExercise.get(key) ?? []
    list.push({ weight: set.weight, reps: set.actualReps ?? set.targetReps, startedAt })
    byExercise.set(key, list)
  }

  const progression = Array.from(byExercise.entries())
    .map(([name, entries]) => {
      const sorted = entries.slice().sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      return { name, count: entries.length, first, last }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (progression.length > 0) {
    lines.push(`- Tiến độ tạ 30 ngày qua:`)
    for (const p of progression) {
      const delta = p.last.weight - p.first.weight
      const trend = delta > 0 ? `↑ +${delta.toFixed(1)}kg` : delta < 0 ? `↓ ${delta.toFixed(1)}kg` : "→ đứng yên"
      lines.push(
        `  • ${p.name}: ${p.first.weight}kg×${p.first.reps} → ${p.last.weight}kg×${p.last.reps} (${trend}, ${p.count} set)`,
      )
    }
  }

  return lines.join("\n")
}

async function chatWithAI(
  profile: SerializedProfile,
  message: string,
  history: ChatMessage[],
) {
  if (!message.trim()) {
    throw new AuthServiceError("Tin nhắn không được để trống.", 400)
  }

  if (message.length > 2000) {
    throw new AuthServiceError("Tin nhắn quá dài (tối đa 2000 ký tự).", 400)
  }

  checkChatRateLimit(profile.id)

  let contextBlock = ""
  try {
    const snapshot = await buildChatContext(profile)
    if (snapshot) {
      contextBlock = `\n\nDữ liệu người dùng gần đây (dùng để trả lời các câu hỏi cá nhân hoá):\n${snapshot}`
    }
  } catch {
    // Never let context building break chat — fall back to generic advice.
  }

  const systemPrompt = `Bạn là AI huấn luyện viên cá nhân và chuyên gia dinh dưỡng. Trả lời ngắn gọn, hữu ích bằng tiếng Việt.

Thông tin người dùng:
- Tên: ${profile.name ?? "Trainee"}
- Chiều cao: ${profile.heightCm ?? "chưa cập nhật"}cm
- Mục tiêu calories: ${profile.dailyCalorieGoal ?? "chưa cập nhật"} kcal/ngày${contextBlock}

QUY TẮC:
1. Trả lời bằng tiếng Việt.
2. CHỈ trả lời về fitness, dinh dưỡng, tập luyện, sức khoẻ. Đây là phạm vi DUY NHẤT.
3. Nếu câu hỏi KHÔNG liên quan fitness/sức khoẻ (toán học, lập trình, kiến thức chung, code, công nghệ, v.v.), từ chối ngắn gọn: "Mình là AI Coach, chỉ hỗ trợ về tập luyện, dinh dưỡng và sức khoẻ thôi nhé! 💪" và KHÔNG trả lời nội dung đó.
4. Không đưa ra lời khuyên y tế chuyên sâu, khuyên người dùng gặp bác sĩ khi cần.
5. Trả lời ngắn gọn (dưới 250 từ), plain text, không markdown.`

  const conversationHistory = history.slice(-6)
  const userPrompt = conversationHistory.length > 0
    ? conversationHistory.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n") + `\nUser: ${message}`
    : message

  const ai = getAIProvider()
  const response = await ai.generateText({
    systemPrompt,
    userPrompt,
    maxTokens: 1024,
  })

  const reply = response.data.trim()
  if (!reply) {
    return { reply: "Mình là AI Coach, chỉ hỗ trợ về tập luyện, dinh dưỡng và sức khoẻ thôi nhé! 💪" }
  }

  return { reply }
}

export {
  acceptAIMealPlan,
  acceptAIProgram,
  chatWithAI,
  generateMealPlan,
  generateWorkoutProgram,
}
