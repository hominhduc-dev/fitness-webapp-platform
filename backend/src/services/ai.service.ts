import { AIGenerationStatus, AIGenerationType, FoodSource, type Prisma, type ProgramDifficulty, type WorkoutKind } from "@prisma/client"
import { randomUUID } from "crypto"

import { getAIProvider } from "../lib/ai/ai-client"
import { prisma, retryTransaction } from "../lib/prisma"
import { buildTraineeChatContext } from "./ai/context/builder"
import { buildAIChatSystemPrompt } from "./ai/context/prompt"
import type { ChatMessage } from "./ai/context/types"
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

const ENGLISH_WORKOUT_NAMES: Record<WorkoutKind, string> = {
  push: "Push Day",
  pull: "Back Day",
  legs: "Leg Day",
  full_body: "Full Body Day",
  cardio: "Cardio Day",
  other: "Training Day",
}

function getEnglishWorkoutName(kind: string) {
  return ENGLISH_WORKOUT_NAMES[toWorkoutKind(kind)]
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
6. Chỉ tạo lịch cho tuần đầu tiên (weekIndex=0). Các tuần sau sẽ lặp lại.
7. workouts[].name BẮT BUỘC bằng tiếng Anh, Title Case và ngắn gọn, ví dụ: Push Day, Back Day, Leg Day, Full Body Day. Không dùng tên tiếng Việt.`

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
        name: getEnglishWorkoutName(workout.kind),
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
// Daily Workout Generation
// ---------------------------------------------------------------------------

type GenerateDailyWorkoutInput = {
  date: string
  goal: string
  experienceLevel: string
  sessionDuration: number
  availableEquipment: string
  focusAreas?: string[]
  injuries?: string
  energyLevel: "low" | "normal" | "high"
}

type AIDailyWorkoutOutput = {
  name: string
  description: string
  kind: string
  duration: number
  warmup: string
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
}

type MappedDailyWorkoutOutput = {
  date: string
  name: string
  description: string
  difficulty: ProgramDifficulty
  kind: WorkoutKind
  duration: number
  warmup: string
  exercises: Array<{
    variationId: string
    sets: number
    reps: number
    repsMin?: number
    rir?: number
    restTime?: number
    weight?: number
  }>
}

const WORKOUT_KINDS = new Set<WorkoutKind>(["push", "pull", "legs", "full_body", "cardio", "other"])

function toWorkoutKind(value: string): WorkoutKind {
  return WORKOUT_KINDS.has(value as WorkoutKind) ? value as WorkoutKind : "other"
}

async function generateDailyWorkout(profile: SerializedProfile, input: GenerateDailyWorkoutInput) {
  const db = ensurePrisma()
  await checkRateLimit(profile.id, AIGenerationType.workout_program)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new AuthServiceError("Ngày tập không hợp lệ.", 400)
  }
  if (!Number.isFinite(input.sessionDuration) || input.sessionDuration < 20 || input.sessionDuration > 120) {
    throw new AuthServiceError("Thời lượng buổi tập phải từ 20 đến 120 phút.", 400)
  }
  if (!(["low", "normal", "high"] as const).includes(input.energyLevel)) {
    throw new AuthServiceError("Mức năng lượng không hợp lệ.", 400)
  }

  const exercises = await db.exercise.findMany({
    include: { variations: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    where: { OR: [{ createdById: null }, { createdById: profile.id }] },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })
  const catalog: ExerciseCatalogItem[] = exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    variations: exercise.variations.map((variation) => ({
      id: variation.id,
      name: variation.name,
      equipment: variation.equipment,
    })),
  }))
  const catalogForPrompt = catalog.map((exercise) => ({
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    variations: exercise.variations.map((variation) => variation.name),
  }))
  const recentLogs = await db.workoutLog.count({
    where: { userId: profile.id, startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  })

  const generation = await db.aIGeneration.create({
    data: {
      id: randomUUID(),
      userId: profile.id,
      type: AIGenerationType.workout_program,
      status: AIGenerationStatus.pending,
      input: { ...input, mode: "daily" } as unknown as Prisma.InputJsonValue,
    },
  })

  const systemPrompt = `Bạn là personal trainer AI. Hãy tạo ĐÚNG MỘT buổi tập cho hôm nay.

QUY TẮC BẮT BUỘC:
1. CHỈ dùng bài tập và variation có trong Exercise Catalog.
2. exerciseName và variationName phải khớp chính xác với catalog.
3. Điều chỉnh volume theo trình độ, thời lượng và mức năng lượng hôm nay.
4. Tôn trọng tuyệt đối chấn thương hoặc bài cần tránh.
5. Trả về JSON thuần tuý, không dùng markdown.
6. kind chỉ được là push, pull, legs, full_body, cardio hoặc other.
7. name BẮT BUỘC bằng tiếng Anh, Title Case và ngắn gọn, ví dụ: Leg Day, Back Day, Push Day hoặc Full Body Day. Không dùng tên tiếng Việt.`

  const userPrompt = `## Người tập
- Ngày tập: ${input.date}
- Mục tiêu: ${GOAL_LABELS[input.goal] ?? input.goal}
- Trình độ: ${LEVEL_LABELS[input.experienceLevel] ?? input.experienceLevel}
- Thời lượng: ${input.sessionDuration} phút
- Thiết bị: ${EQUIPMENT_LABELS[input.availableEquipment] ?? input.availableEquipment}
- Mức năng lượng: ${input.energyLevel}
${input.focusAreas?.length ? `- Nhóm cơ hôm nay: ${input.focusAreas.join(", ")}` : "- Nhóm cơ hôm nay: AI tự cân đối"}
${input.injuries ? `- Chấn thương/hạn chế: ${input.injuries}` : "- Không khai báo chấn thương"}
- Số buổi đã tập trong 30 ngày: ${recentLogs}

## Exercise Catalog
${JSON.stringify(catalogForPrompt)}

## Output JSON Schema
{
  "name": "Tên buổi tập bằng tiếng Việt",
  "description": "Mô tả ngắn",
  "kind": "push|pull|legs|full_body|cardio|other",
  "duration": ${input.sessionDuration},
  "warmup": "Hướng dẫn khởi động ngắn",
  "exercises": [{
    "exerciseName": "Tên chính xác từ catalog",
    "variationName": "Variation chính xác từ catalog",
    "sets": 3,
    "reps": 12,
    "repsMin": 8,
    "rir": 2,
    "restTime": 90,
    "weight": 0
  }]
}`

  try {
    const response = await getAIProvider().generateStructuredJSON<AIDailyWorkoutOutput>({
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    })
    const raw = response.data
    const mappedExercises = raw.exercises.map((exercise) => {
      const variationId = mapExerciseToVariation(exercise.exerciseName, exercise.variationName, catalog)
      if (!variationId) return null
      return {
        variationId,
        sets: Math.max(1, Math.min(8, Math.round(exercise.sets))),
        reps: Math.max(1, Math.round(exercise.reps)),
        repsMin: exercise.repsMin ? Math.max(1, Math.round(exercise.repsMin)) : undefined,
        rir: exercise.rir == null ? undefined : Math.max(0, Math.min(4, Math.round(exercise.rir))),
        restTime: exercise.restTime ? Math.max(15, Math.round(exercise.restTime)) : undefined,
        weight: exercise.weight && exercise.weight > 0 ? exercise.weight : undefined,
      }
    }).filter(Boolean) as MappedDailyWorkoutOutput["exercises"]

    const mappingRate = raw.exercises.length > 0 ? mappedExercises.length / raw.exercises.length : 0
    if (mappedExercises.length === 0 || mappingRate < 0.7) {
      await db.aIGeneration.update({
        where: { id: generation.id },
        data: { status: AIGenerationStatus.failed, output: raw as unknown as Prisma.InputJsonValue, tokenUsage: response.tokenUsage, errorMsg: `Chỉ map được ${Math.round(mappingRate * 100)}% bài tập.` },
      })
      throw new AuthServiceError("Nhiều bài AI đề xuất không có trong thư viện. Vui lòng thử lại.", 422)
    }

    const mapped: MappedDailyWorkoutOutput = {
      date: input.date,
      name: getEnglishWorkoutName(raw.kind),
      description: raw.description,
      difficulty: mapDifficulty(input.experienceLevel),
      kind: toWorkoutKind(raw.kind),
      duration: input.sessionDuration,
      warmup: raw.warmup,
      exercises: mappedExercises,
    }
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.completed,
        output: { mode: "daily", raw, mapped } as unknown as Prisma.InputJsonValue,
        tokenUsage: response.tokenUsage,
      },
    })

    return { generationId: generation.id, workout: mapped, mappingRate: Math.round(mappingRate * 100) }
  } catch (error) {
    if (error instanceof AuthServiceError) throw error
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: { status: AIGenerationStatus.failed, errorMsg: error instanceof Error ? error.message : "Unknown error" },
    })
    throw new AuthServiceError("Không thể tạo buổi tập hôm nay. Vui lòng thử lại sau.", 500)
  }
}

async function acceptDailyWorkout(profile: SerializedProfile, generationId: string) {
  const db = ensurePrisma()
  const generation = await db.aIGeneration.findUnique({ where: { id: generationId } })
  if (!generation || generation.userId !== profile.id) {
    throw new AuthServiceError("Không tìm thấy kết quả AI.", 404)
  }
  if (generation.status !== AIGenerationStatus.completed) {
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", 400)
  }
  const output = generation.output as { mode?: string; mapped?: MappedDailyWorkoutOutput } | null
  if (output?.mode !== "daily" || !output.mapped) {
    throw new AuthServiceError("Dữ liệu buổi tập AI không hợp lệ.", 400)
  }
  const mapped = output.mapped
  const scheduledDate = new Date(`${mapped.date}T00:00:00.000Z`)

  return retryTransaction(() => db.$transaction(async (tx) => {
    const programId = randomUUID()
    const workoutId = randomUUID()
    await tx.program.create({
      data: {
        id: programId,
        name: mapped.name,
        description: mapped.description,
        difficulty: mapped.difficulty,
        duration: 1,
        workoutsPerWeek: 1,
        isAIGenerated: true,
        createdById: profile.id,
      },
    })
    await tx.programAssignment.create({ data: { programId, userId: profile.id } })
    await tx.workout.create({
      data: {
        id: workoutId,
        programId,
        name: mapped.name,
        kind: mapped.kind,
        scheduledDate,
        duration: mapped.duration,
        notes: mapped.warmup ? `Khởi động: ${mapped.warmup}` : mapped.description,
      },
    })
    for (let index = 0; index < mapped.exercises.length; index += 1) {
      const exercise = mapped.exercises[index]
      const workoutExerciseId = randomUUID()
      await tx.workoutExercise.create({
        data: { id: workoutExerciseId, workoutId, variationId: exercise.variationId, order: index + 1, restTime: exercise.restTime },
      })
      await tx.exerciseSet.createMany({
        data: Array.from({ length: exercise.sets }, (_, setIndex) => ({
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
    await tx.aIGeneration.update({ where: { id: generationId }, data: { status: AIGenerationStatus.accepted, programId } })
    return { accepted: true, workoutId }
  }, { maxWait: 15000, timeout: 60000 }))
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

  let systemPrompt: string
  try {
    const chatContext = await buildTraineeChatContext({ history, message, profile })
    systemPrompt = buildAIChatSystemPrompt(profile, chatContext)
  } catch {
    // Never let context building break chat — fall back to generic advice.
    systemPrompt = buildAIChatSystemPrompt(profile, null)
  }

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
  acceptDailyWorkout,
  acceptAIMealPlan,
  acceptAIProgram,
  chatWithAI,
  generateDailyWorkout,
  generateMealPlan,
  generateWorkoutProgram,
}
