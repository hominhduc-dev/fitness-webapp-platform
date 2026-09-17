import { AIGenerationStatus, AIGenerationType, FoodSource, MealStatus, UserRole, type Prisma, type ProgramDifficulty, type WorkoutKind } from "@prisma/client"
import { randomUUID } from "crypto"
import { generateValidatedJSON } from "../lib/ai/validated-generation"

import { getAIProvider } from "../lib/ai/ai-client"
import type { AIConversationMessage } from "../lib/ai/types"
import { normalizeAIWorkoutOutput } from "../lib/ai/workout-output"
import { prisma, retryTransaction } from "../lib/prisma"
import {
  chatTools,
  CREATE_MEAL_PLAN,
  CREATE_WORKOUT_PROGRAM,
  normalizeCreateMealPlanArgs,
  normalizeCreateProgramArgs,
} from "./ai/chat-tools"
import { DailyCounter } from "./ai/daily-counter"
import { buildTraineeChatContext } from "./ai/context/builder"
import { buildRecoveryContext } from "./ai/context/recovery-context"
import { parseExerciseSnapshot } from "./ai/context/helpers"
import { selectCatalogForPrompt } from "./ai/exercise-catalog"
import { claimGeneration, validateAccessibleVariations } from "./ai/acceptance"
import { parseAI, programOutputSchema, mappedProgramSchema, dailyOutputSchema, mappedDailySchema, mealPlanOutputSchema, mealSchema, mappedMealsSchema, storedMealPlanSchema, dateSchema, type StoredMealPlan } from "../lib/ai/output-schemas"
import { generateProgramSchema, generateDailyWorkoutSchema, generateMealPlanSchema, chatSchema } from "../routes/ai.schemas"
import { startOfClientDay, dateKeyInstant, plusDays } from "../lib/ai/calendar"
import { buildAIChatSystemPrompt } from "./ai/context/prompt"
import type { ChatMessage } from "./ai/context/types"
import { AppError, AuthServiceError, TooManyRequestsError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { addMealItemForUser, calculateItemNutrition } from "./nutrition.service"
import type { Nutrients } from "../lib/nutrition/portion-scaler"
import { selectFoodsForPrompt } from "./ai/food-catalog"
import {
  applyMealPlanOverrides,
  buildDayPlanPrompt,
  buildMealSwapPrompt,
  buildShoppingList,
  canPlanCalories,
  dayNutrients,
  emptyNutrients,
  fitMealsToTarget,
  hasCustomMacroGoals,
  MEAL_TYPES,
  planDates,
  remainingTargets,
  roundNutrients,
  sumNutrients,
  validateDayTargets,
  type DraftItem,
  type MealPlanOverrides,
  type PlanDay,
  type PlanFood,
  type PlanMealType,
  type PromptFilters,
} from "./ai/meal-plan"

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

const DAILY_LIMITS: Record<AIGenerationType, number> = {
  workout_program: 5,
  meal_plan: 10,
}

async function checkRateLimit(userId: string, type: AIGenerationType) {
  const db = ensurePrisma()
  const startOfDay = startOfClientDay()

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
const chatMessageCounter = new DailyCounter(40)

// Chat is a second way into program generation, and the model decides when to
// use it. Without a budget of its own, a few misread messages could burn the
// whole daily allowance that the /workout/ai-generate form depends on, so cap
// how much of it a conversation may consume.
const chatProgramCounter = new DailyCounter(3)
const chatMealPlanCounter = new DailyCounter(5)

function checkChatRateLimit(userId: string) {
  if (!chatMessageCounter.tryConsume(userId)) {
    throw new AuthServiceError(
      `Bạn đã đạt giới hạn ${chatMessageCounter.max} tin nhắn AI mỗi ngày. Vui lòng thử lại vào ngày mai.`,
      429,
    )
  }
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

function requirePromptVariation(id: string, catalog: Array<{ variations: Array<{ id: string }> }>, context: string) {
  if (!catalog.some(exercise => exercise.variations.some(variation => variation.id === id))) {
    throw new AppError(`${context}: bài tập ${id} không nằm trong thư viện phù hợp thiết bị. Không có bài nào được tự thay thế; hãy tạo lại.`, { status: 422, code: "AI_UNAVAILABLE_EXERCISE" })
  }
  return id
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
  return generateWorkoutProgramForSubject(profile, profile, input)
}

async function requireCoachTraineeProfile(coach: SerializedProfile, traineeId: string) {
  if (coach.role !== UserRole.coach) {
    throw new AuthServiceError("Chỉ coach mới có thể tạo program AI cho trainee.", 403)
  }

  const db = ensurePrisma()
  const trainee = await db.user.findFirst({
    where: {
      coachId: coach.id,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new AuthServiceError("Không tìm thấy trainee thuộc coach này.", 404)
  }

  return trainee as unknown as SerializedProfile
}

async function generateCoachTraineeWorkoutProgram(
  coach: SerializedProfile,
  traineeId: string,
  input: GenerateProgramInput,
) {
  const trainee = await requireCoachTraineeProfile(coach, traineeId)
  return generateWorkoutProgramForSubject(coach, trainee, input, {
    coachGenerated: true,
    traineeId,
  })
}

async function generateWorkoutProgramForSubject(
  owner: SerializedProfile,
  subject: SerializedProfile,
  input: GenerateProgramInput,
  metadata?: Record<string, unknown>,
) {
  input = parseAI(generateProgramSchema, input, 400)
  const db = ensurePrisma()
  await checkRateLimit(owner.id, AIGenerationType.workout_program)

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
        { createdById: owner.id },
      ],
    },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })


  const recentLogs = await db.workoutLog.findMany({
    where: {
      userId: subject.id,
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
  const recoveryContext = await buildRecoveryContext(db, subject, new Date())

  const systemPrompt = `Bạn là một personal trainer AI chuyên nghiệp. Tạo chương trình tập luyện cá nhân hoá dựa trên thông tin người dùng.

QUY TẮC BẮT BUỘC:
1. CHỈ sử dụng bài tập từ Exercise Catalog được cung cấp. KHÔNG tự nghĩ ra bài tập mới.
2. variationId BẮT BUỘC là ID variation trong catalog; không tự tạo ID hoặc thay thế thiết bị.
3. Trả về JSON thuần tuý, KHÔNG wrap trong markdown code block.
4. weekIndex bắt đầu từ 0, scheduledDay: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7.
5. kind phải là một trong: push, pull, legs, full_body, cardio, other.
6. Chỉ tạo lịch cho tuần đầu tiên (weekIndex=0). Các tuần sau sẽ lặp lại.
7. workouts[].name BẮT BUỘC bằng tiếng Anh, Title Case và ngắn gọn, ví dụ: Push Day, Back Day, Leg Day, Full Body Day. Không dùng tên tiếng Việt.
8. Mọi bài tập BẮT BUỘC có sets (số nguyên 1-12) và reps (số nguyên 1-200). Tổng sets phải phù hợp thời lượng; không nhồi volume quá mức. repsMin chỉ là cận dưới tùy chọn, không thay thế reps.`

  const weightInfo = subject.targetWeightKg
    ? `Cân nặng mục tiêu: ${subject.targetWeightKg}kg`
    : ""
  const heightInfo = subject.heightCm ? `Chiều cao: ${subject.heightCm}cm` : ""

  const userPrompt = `## Thông tin người dùng
- Người được thiết kế program: ${subject.name}${owner.id !== subject.id ? ` (trainee của coach ${owner.name})` : ""}
- Mục tiêu: ${GOAL_LABELS[input.goal] ?? input.goal}
- Recovery / Readiness: ${recoveryContext?.content ?? "Chưa có dữ liệu phục hồi; không tự suy đoán."}
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
      "variationId": "UUID chính xác của variation trong catalog",
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
      userId: owner.id,
      type: AIGenerationType.workout_program,
      status: AIGenerationStatus.pending,
      input: { ...input, ...(metadata ?? {}) } as unknown as Prisma.InputJsonValue,
    },
  })

  try {
    const ai = getAIProvider()
    const response = await ai.generateStructuredJSON<AIWorkoutOutput>({
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
    })

    const aiOutput = parseAI(programOutputSchema, normalizeAIWorkoutOutput(response.data))
    if (aiOutput.workouts.some(w => w.duration > input.sessionDuration)) throw new AppError("Thời lượng AI tạo vượt quá yêu cầu. Hãy tạo lại.", { status: 422 })
    if (aiOutput.workouts.length !== input.daysPerWeek) throw new AppError("Số buổi AI tạo không khớp yêu cầu. Hãy tạo lại.", { status: 422 })
    validateWorkoutWorkload(aiOutput.workouts, input.sessionDuration)

    const mappedWorkouts = aiOutput.workouts.map((workout) => {
      const mappedExercises = workout.exercises
        .map((exercise) => {
          const variationId = requirePromptVariation(exercise.variationId, catalogForPrompt, workout.name)
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

      return {
        name: getEnglishWorkoutName(workout.kind),
        kind: workout.kind,
        weekIndex: workout.weekIndex,
        scheduledDay: workout.scheduledDay,
        duration: workout.duration,
        exercises: mappedExercises,
      }
    })

    const mappingRate = 1

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
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.failed,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
      },
    })
    if (error instanceof AppError) throw error
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
  return acceptAIProgramForAssignee(profile, profile.id, generationId)
}

async function acceptCoachTraineeAIProgram(coach: SerializedProfile, traineeId: string, generationId: string) {
  await requireCoachTraineeProfile(coach, traineeId)
  return acceptAIProgramForAssignee(coach, traineeId, generationId, { expectedTraineeId: traineeId })
}

async function acceptAIProgramForAssignee(
  profile: SerializedProfile,
  assigneeUserId: string,
  generationId: string,
  options?: { expectedTraineeId?: string },
) {
  const db = ensurePrisma()

  const generation = await db.aIGeneration.findUnique({
    where: { id: generationId },
  })

  if (!generation || generation.userId !== profile.id) {
    throw new AuthServiceError("Không tìm thấy kết quả AI.", 404)
  }

  if (generation.status !== AIGenerationStatus.completed) {
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", generation.status === AIGenerationStatus.accepted ? 409 : 400)
  }

  if (generation.type !== AIGenerationType.workout_program) {
    throw new AuthServiceError("Kết quả AI không phải chương trình tập luyện.", 400)
  }

  const rawInput = generation.input as Record<string, unknown> | null
  if (options?.expectedTraineeId && rawInput?.traineeId !== options.expectedTraineeId) {
    throw new AuthServiceError("Draft AI này không thuộc trainee đang chọn.", 409)
  }

  const output = generation.output as { mode?: string; mapped: MappedProgramOutput } | null
  if (!output?.mapped || output.mode === "daily") {
    throw new AuthServiceError("Dữ liệu chương trình AI không hợp lệ.", 400)
  }

  // Revalidate legacy generations too, before any transaction writes begin.
  const mapped = parseAI(mappedProgramSchema, normalizeAIWorkoutOutput(output.mapped))
  const equipment = parseAI(generateProgramSchema, generation.input, 422).availableEquipment

  const program = await retryTransaction(() =>
    db.$transaction(async (tx) => {
      await claimGeneration(tx, generationId, profile.id, AIGenerationType.workout_program)
      await validateAccessibleVariations(tx, mapped.workouts.flatMap(w => w.exercises.map(e => e.variationId)), profile.id, equipment)
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
          userId: assigneeUserId,
        },
      })

      for (const workout of mapped.workouts) {
        const workoutId = randomUUID()

        await tx.workout.create({
          data: {
            id: workoutId,
            programId,
            name: workout.name,
            kind: workout.kind,
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

          const setCount = exercise.sets
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
      isolationLevel: "Serializable",
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
  input = parseAI(generateDailyWorkoutSchema, input, 400)
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
  const catalogForPrompt = selectCatalogForPrompt(exercises, input)
  const recoveryContext = await buildRecoveryContext(db, profile, new Date())
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
2. variationId BẮT BUỘC là ID variation trong catalog; không tự tạo ID hoặc thay thế thiết bị.
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
\n## Recovery / Readiness\n${recoveryContext?.content ?? "Chưa có dữ liệu phục hồi; không tự suy đoán."}

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
    "variationId": "UUID chính xác của variation trong catalog",
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
    const raw = parseAI(dailyOutputSchema, normalizeAIWorkoutOutput({ workouts: [response.data] }).workouts[0])
    const mappedExercises = raw.exercises.map(exercise => ({
      ...exercise,
      variationId: requirePromptVariation(exercise.variationId, catalogForPrompt, raw.name),
    }))
    const mappingRate = 1

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
    validateWorkoutWorkload([raw], input.sessionDuration)
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
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: { status: AIGenerationStatus.failed, errorMsg: error instanceof Error ? error.message : "Unknown error" },
    })
    if (error instanceof AppError) throw error
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
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", generation.status === AIGenerationStatus.accepted ? 409 : 400)
  }
  const output = generation.output as { mode?: string; mapped?: MappedDailyWorkoutOutput } | null
  if (generation.type !== AIGenerationType.workout_program || output?.mode !== "daily" || !output.mapped) {
    throw new AuthServiceError("Dữ liệu buổi tập AI không hợp lệ.", 400)
  }
  const mapped = parseAI(mappedDailySchema, { ...output.mapped, exercises: normalizeAIWorkoutOutput({ workouts: [output.mapped] }).workouts[0].exercises })
  const equipment = parseAI(generateDailyWorkoutSchema, generation.input, 422).availableEquipment
  const scheduledDate = new Date(`${mapped.date}T00:00:00.000Z`)

  return retryTransaction(() => db.$transaction(async (tx) => {
    await claimGeneration(tx, generationId, profile.id, AIGenerationType.workout_program)
    await validateAccessibleVariations(tx, mapped.exercises.map(e => e.variationId), profile.id, equipment)
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
  }, { maxWait: 15000, timeout: 60000, isolationLevel: "Serializable" }))
}

// ---------------------------------------------------------------------------
// Meal Plan Generation
// ---------------------------------------------------------------------------

type GenerateMealPlanInput = {
  date: string
  days?: number
  preferences?: string
  budget?: string
  cookingTime?: string
}

type MealPlanDb = NonNullable<typeof prisma>
type DraftDay = { date: string; targets: Nutrients; meals: Array<{ type: PlanMealType; items: DraftItem[] }> }

const MEAL_PLAN_FOOD_SELECT = {
  calories: true,
  carbs: true,
  category: true,
  fat: true,
  id: true,
  name: true,
  prepMinutes: true,
  priceTier: true,
  protein: true,
  servingAmount: true,
  servingLabel: true,
  servingUnit: true,
  source: true,
} satisfies Prisma.FoodSelect

/** Swapping one meal costs far less than a whole plan, but still spends provider tokens. */
const mealSwapCounter = new DailyCounter(20)

function mealPlanGoals(profile: SerializedProfile): Nutrients {
  return {
    calories: profile.dailyCalorieGoal,
    protein: profile.dailyProteinGoal ?? 140,
    carbs: profile.dailyCarbsGoal ?? 280,
    fat: profile.dailyFatGoal ?? 70,
  }
}

function mealPlanFilters(profile: SerializedProfile, input: { budget?: string; cookingTime?: string; preferences?: string }): PromptFilters {
  return {
    allergies: profile.foodAllergies ?? [],
    dietType: profile.dietType ?? null,
    budget: input.budget,
    cookingTime: input.cookingTime,
    preferences: input.preferences,
  }
}

function loadMealPlanFoods(db: MealPlanDb, profileId: string) {
  return db.food.findMany({
    orderBy: { name: "asc" },
    select: MEAL_PLAN_FOOD_SELECT,
    where: { OR: [{ source: FoodSource.system }, { createdById: profileId, source: FoodSource.user }] },
  })
}

/** What the trainee actually ate in the week before `startDate`, to steer variety. */
async function loadRecentMealFoods(db: MealPlanDb, profileId: string, startDate: string) {
  const start = dateKeyInstant(startDate)
  const meals = await db.meal.findMany({
    include: { items: { include: { food: { select: { name: true } } } } },
    orderBy: { loggedDate: "desc" },
    take: 28,
    where: { loggedDate: { gte: plusDays(start, -7), lt: start }, status: MealStatus.consumed, userId: profileId },
  })
  const items = meals.flatMap((meal) => meal.items)
  return {
    ids: new Set(items.map((item) => item.foodId)),
    names: [...new Set(items.map((item) => item.food?.name ?? item.foodNameSnapshot ?? ""))].filter(Boolean).slice(0, 15),
  }
}

/** Meals already eaten on each planned day: their totals and the meal types they fill. */
async function loadConsumedMeals(db: MealPlanDb, profileId: string, dates: string[]) {
  const meals = await db.meal.findMany({
    select: { calories: true, carbs: true, fat: true, items: { select: { id: true } }, loggedDate: true, protein: true, type: true },
    where: {
      loggedDate: { gte: dateKeyInstant(dates[0]), lte: dateKeyInstant(dates[dates.length - 1]) },
      status: MealStatus.consumed,
      userId: profileId,
    },
  })
  const byDate = new Map<string, { totals: Nutrients; types: Set<string> }>()
  for (const meal of meals) {
    // A section whose items were all deleted is an empty row, not an eaten meal.
    if (meal.items.length === 0 && meal.calories <= 0) continue
    const key = meal.loggedDate.toISOString().slice(0, 10)
    const entry = byDate.get(key) ?? { totals: emptyNutrients(), types: new Set<string>() }
    entry.totals = sumNutrients([entry.totals, { calories: meal.calories, protein: meal.protein ?? 0, carbs: meal.carbs ?? 0, fat: meal.fat ?? 0 }])
    entry.types.add(meal.type)
    byDate.set(key, entry)
  }
  return byDate
}

function buildMealPlanResponse(generationId: string, plan: StoredMealPlan, foodsById: ReadonlyMap<string, PlanFood>) {
  return {
    generationId,
    days: plan.days.map((day) => ({ ...day, totals: roundNutrients(dayNutrients(day.meals)) })),
    shoppingList: buildShoppingList(plan.days, foodsById),
    notes: plan.notes,
  }
}

type MealPlanResponse = ReturnType<typeof buildMealPlanResponse>

async function generateMealPlan(profile: SerializedProfile, rawInput: GenerateMealPlanInput): Promise<MealPlanResponse> {
  const input = parseAI(generateMealPlanSchema, rawInput, 400)
  const goals = mealPlanGoals(profile)
  if (!Number.isFinite(goals.calories) || goals.calories <= 0) {
    throw new AppError("Hãy cập nhật mục tiêu calories trong hồ sơ trước khi tạo thực đơn.", { status: 422, code: "AI_MISSING_CALORIE_GOAL" })
  }
  const db = ensurePrisma()
  await checkRateLimit(profile.id, AIGenerationType.meal_plan)

  const dates = planDates(input.date, input.days ?? 1)
  const [foods, recent, consumedByDate] = await Promise.all([
    loadMealPlanFoods(db, profile.id),
    loadRecentMealFoods(db, profile.id, input.date),
    loadConsumedMeals(db, profile.id, dates),
  ])

  // Plan only what is left of each day: meal types not yet eaten, against the remaining goals.
  const customMacros = hasCustomMacroGoals(goals)
  const plannedDays = dates.map((date) => {
    const logged = consumedByDate.get(date)
    const consumed = roundNutrients(logged?.totals ?? emptyNutrients())
    return {
      date,
      consumed,
      mealTypes: MEAL_TYPES.filter((type) => !logged?.types.has(type)),
      targets: remainingTargets(goals, consumed),
    }
  })
  const blocked = plannedDays.find((day) => day.mealTypes.length === 0 || !canPlanCalories(day.targets))
  if (blocked) {
    throw new AppError(
      `Ngày ${blocked.date} đã ghi ${Math.round(blocked.consumed.calories)} kcal${blocked.mealTypes.length === 0 ? " đủ cả 4 bữa" : ""}, không còn đủ mục tiêu để lên thực đơn. Hãy chọn ngày khác.`,
      { status: 422, code: "AI_NOTHING_TO_PLAN" },
    )
  }

  const filters = mealPlanFilters(profile, input)
  const catalog = selectFoodsForPrompt(foods, { ...filters, recentFoodIds: recent.ids })
  if (catalog.length === 0) {
    throw new AppError("Không còn món nào sau khi lọc dị ứng, chế độ ăn, ngân sách và thời gian nấu. Hãy nới bớt điều kiện.", { status: 422, code: "AI_CATALOG_TOO_SMALL" })
  }
  const foodsById = new Map<string, PlanFood>(catalog.map((food) => [food.id, food]))
  const prompt = buildDayPlanPrompt({ days: plannedDays, catalog, filters, recentFoodNames: recent.names })

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
    const response = await generateValidatedJSON(getAIProvider(), { ...prompt, maxTokens: Math.min(8192, 2048 + dates.length * 1024) }, (data) => {
      const output = parseAI(mealPlanOutputSchema, data)
      if (output.days.length !== plannedDays.length || output.days.some((day, index) => day.date !== plannedDays[index].date)) {
        throw new AppError(`Phải trả đúng ${plannedDays.length} ngày theo thứ tự: ${dates.join(", ")}.`, { status: 422, code: "AI_VALIDATION_ERROR" })
      }
      const days: PlanDay[] = output.days.map((day, index) => {
        const planned = plannedDays[index]
        if (day.meals.length !== planned.mealTypes.length || planned.mealTypes.some((type) => !day.meals.some((meal) => meal.type === type))) {
          throw new AppError(`Ngày ${day.date} phải có đúng các bữa: ${planned.mealTypes.join(", ")}.`, { status: 422, code: "AI_VALIDATION_ERROR" })
        }
        const ordered = planned.mealTypes.flatMap((type) => day.meals.filter((meal) => meal.type === type))
        const meals = fitMealsToTarget(ordered, foodsById, planned.targets, customMacros)
        validateDayTargets(day.date, dayNutrients(meals), planned.targets, customMacros)
        return { date: day.date, targets: planned.targets, consumed: planned.consumed, meals }
      })
      return { days, notes: output.notes, raw: output }
    })

    const plan: StoredMealPlan = {
      days: response.data.days,
      notes: response.data.notes,
      context: { ...filters, allergies: [...filters.allergies], customMacros },
    }
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.completed,
        output: { raw: response.data.raw, mapped: plan } as unknown as Prisma.InputJsonValue,
        tokenUsage: response.tokenUsage,
      },
    })

    return buildMealPlanResponse(generation.id, plan, foodsById)
  } catch (error) {
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: {
        status: AIGenerationStatus.failed,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
      },
    })
    if (error instanceof AppError) throw error
    throw new AuthServiceError("Không thể tạo thực đơn AI. Vui lòng thử lại sau.", 500)
  }
}

// ---------------------------------------------------------------------------
// Accept Meal Plan — saved as planned meals, confirmed one by one when eaten
// ---------------------------------------------------------------------------

function toDraftDay(day: DraftDay): DraftDay {
  return {
    date: day.date,
    targets: day.targets,
    meals: day.meals.map((meal) => ({
      type: meal.type,
      items: meal.items.map(({ amountUnit, amountValue, foodId }) => ({ amountUnit, amountValue, foodId })),
    })),
  }
}

/** Drafts saved before multi-day plans stored a single day as a bare meal array. */
function readAcceptableMealPlan(mapped: unknown, date: string, profile: SerializedProfile): { customMacros: boolean; days: DraftDay[] } {
  if (Array.isArray(mapped)) {
    const goals = mealPlanGoals(profile)
    return { customMacros: hasCustomMacroGoals(goals), days: [toDraftDay({ date, targets: goals, meals: parseAI(mappedMealsSchema, mapped) })] }
  }
  const plan = parseAI(storedMealPlanSchema, mapped)
  if (plan.days[0].date !== date) {
    throw new AppError("Ngày lưu không khớp với bản nháp thực đơn.", { status: 400 })
  }
  return { customMacros: plan.context.customMacros, days: plan.days.map(toDraftDay) }
}

async function acceptAIMealPlan(profile: SerializedProfile, generationId: string, date: string, overrides?: MealPlanOverrides) {
  const db = ensurePrisma()

  const generation = await db.aIGeneration.findUnique({
    where: { id: generationId },
  })

  if (!generation || generation.userId !== profile.id) {
    throw new AuthServiceError("Không tìm thấy kết quả AI.", 404)
  }

  if (generation.status !== AIGenerationStatus.completed) {
    throw new AuthServiceError("Kết quả AI chưa sẵn sàng hoặc đã được chấp nhận.", generation.status === AIGenerationStatus.accepted ? 409 : 400)
  }

  if (generation.type !== AIGenerationType.meal_plan) throw new AppError("Kết quả AI không phải thực đơn.", { status: 400 })
  const targetDate = parseAI(dateSchema, date, 400)
  const draft = readAcceptableMealPlan((generation.output as { mapped?: unknown } | null)?.mapped, targetDate, profile)
  const days = overrides ? applyMealPlanOverrides(draft.days, overrides) : draft.days
  if (days.length === 0) throw new AppError("Không còn món nào để lưu.", { status: 400 })

  return retryTransaction(() => db.$transaction(async tx => {
    await claimGeneration(tx, generationId, profile.id, AIGenerationType.meal_plan)
    // Recalculate against today's catalog inside the same transaction.
    const ids = [...new Set(days.flatMap(day => day.meals.flatMap(meal => meal.items.map(item => item.foodId))))]
    const foods = await tx.food.findMany({ where: { id: { in: ids }, OR: [{ source: FoodSource.system }, { source: FoodSource.user, createdById: profile.id }] } })
    for (const day of days) {
      const totals = sumNutrients(day.meals.flatMap(meal => meal.items.map(item => {
        const food = foods.find(f => f.id === item.foodId)
        if (!food || (item.amountUnit !== "serving" && (item.amountUnit !== food.servingUnit || food.servingAmount <= 0))) {
          throw new AppError("Thực phẩm đã thay đổi, bị xóa hoặc không thể quy đổi khẩu phần. Chưa lưu món nào; hãy tạo lại.", { status: 422, code: "AI_CATALOG_CHANGED" })
        }
        const nutrition = calculateItemNutrition(food, item)
        return { calories: nutrition.calories, protein: nutrition.protein ?? 0, carbs: nutrition.carbs ?? 0, fat: nutrition.fat ?? 0 }
      })))
      // Portions the trainee edited are their call; only an untouched draft must still meet the targets.
      if (!overrides) validateDayTargets(day.date, totals, day.targets, draft.customMacros)
    }
    // A newly accepted plan replaces the planned menu for those days instead of stacking onto it.
    await tx.meal.deleteMany({ where: { loggedDate: { in: days.map(day => dateKeyInstant(day.date)) }, status: MealStatus.planned, userId: profile.id } })
    let logged = 0
    for (const day of days) for (const meal of day.meals) for (const item of meal.items) {
      await addMealItemForUser(profile, { date: day.date, mealType: meal.type, status: MealStatus.planned, ...item }, tx)
      logged += 1
    }
    return { accepted: true, dates: days.map(day => day.date), logged, skipped: 0 }
  }, { maxWait: 15000, timeout: 60000, isolationLevel: "Serializable" }))
}

// ---------------------------------------------------------------------------
// Swap one meal inside a draft plan
// ---------------------------------------------------------------------------

async function regenerateAIMealPlanMeal(
  profile: SerializedProfile,
  input: { generationId: string; date: string; mealType: PlanMealType },
): Promise<MealPlanResponse> {
  const db = ensurePrisma()
  const generation = await db.aIGeneration.findUnique({ where: { id: input.generationId } })
  if (!generation || generation.userId !== profile.id || generation.type !== AIGenerationType.meal_plan) {
    throw new AuthServiceError("Không tìm thấy thực đơn AI.", 404)
  }
  if (generation.status !== AIGenerationStatus.completed) {
    throw new AppError("Thực đơn đã được lưu hoặc chưa sẵn sàng nên không đổi bữa được nữa.", { status: 409, code: "AI_ALREADY_ACCEPTED" })
  }
  const output = generation.output as { mapped?: unknown; raw?: unknown } | null
  if (Array.isArray(output?.mapped)) {
    throw new AppError("Bản nháp này tạo từ phiên bản cũ. Hãy tạo thực đơn mới để đổi bữa.", { status: 400 })
  }
  const plan = parseAI(storedMealPlanSchema, output?.mapped)
  const dayIndex = plan.days.findIndex((day) => day.date === input.date)
  const day = plan.days[dayIndex]
  const mealIndex = day ? day.meals.findIndex((meal) => meal.type === input.mealType) : -1
  if (!day || mealIndex < 0) throw new AppError("Không tìm thấy bữa cần đổi trong thực đơn.", { status: 404 })

  const otherMeals = day.meals.filter((_, index) => index !== mealIndex)
  const target = remainingTargets(day.targets, dayNutrients(otherMeals))
  if (target.calories < 80) {
    throw new AppError("Các bữa khác đã gần đủ mục tiêu ngày nên không còn năng lượng cho bữa này. Hãy giảm bớt món ở bữa khác trước.", { status: 422 })
  }

  if (!mealSwapCounter.tryConsume(profile.id)) {
    throw new TooManyRequestsError(`Bạn đã đổi bữa ${mealSwapCounter.max} lần hôm nay. Vui lòng thử lại vào ngày mai.`)
  }

  try {
    const [foods, recent] = await Promise.all([loadMealPlanFoods(db, profile.id), loadRecentMealFoods(db, profile.id, plan.days[0].date)])
    const currentMeal = day.meals[mealIndex]
    const currentFoodIds = new Set(currentMeal.items.map((item) => item.foodId))
    const catalog = selectFoodsForPrompt(foods, { ...plan.context, recentFoodIds: recent.ids }).filter((food) => !currentFoodIds.has(food.id))
    if (catalog.length === 0) throw new AppError("Không còn món khác phù hợp để đổi bữa này.", { status: 422 })
    const catalogById = new Map<string, PlanFood>(catalog.map((food) => [food.id, food]))
    const prompt = buildMealSwapPrompt({
      catalog,
      currentFoodNames: currentMeal.items.map((item) => item.foodName),
      date: input.date,
      filters: plan.context,
      mealType: input.mealType,
      otherFoodNames: otherMeals.flatMap((meal) => meal.items.map((item) => item.foodName)),
      recentFoodNames: recent.names,
      target,
    })

    const response = await generateValidatedJSON(getAIProvider(), { ...prompt, maxTokens: 1536 }, (data) => {
      const meal = parseAI(mealSchema, data)
      if (meal.type !== input.mealType) {
        throw new AppError(`Phải trả đúng bữa ${input.mealType}.`, { status: 422, code: "AI_VALIDATION_ERROR" })
      }
      const [mapped] = fitMealsToTarget([meal], catalogById, target, plan.context.customMacros)
      validateDayTargets(input.date, dayNutrients([...otherMeals, mapped]), day.targets, plan.context.customMacros)
      return mapped
    })

    const nextPlan: StoredMealPlan = {
      ...plan,
      days: plan.days.map((current, index) =>
        index !== dayIndex ? current : { ...current, meals: current.meals.map((meal, position) => (position === mealIndex ? response.data : meal)) },
      ),
    }
    // Conditional on `completed` so a swap can never rewrite a plan that was accepted meanwhile.
    const saved = await db.aIGeneration.updateMany({
      data: {
        output: { ...output, mapped: nextPlan } as unknown as Prisma.InputJsonValue,
        tokenUsage: (generation.tokenUsage ?? 0) + response.tokenUsage,
      },
      where: { id: generation.id, status: AIGenerationStatus.completed, userId: profile.id },
    })
    if (saved.count !== 1) {
      throw new AppError("Thực đơn vừa được lưu ở nơi khác. Vui lòng tải lại.", { status: 409, code: "AI_ALREADY_ACCEPTED" })
    }

    return buildMealPlanResponse(generation.id, nextPlan, new Map<string, PlanFood>(foods.map((food) => [food.id, food])))
  } catch (error) {
    // The attempt produced nothing, so it should not count against the budget.
    mealSwapCounter.release(profile.id)
    if (error instanceof AppError) throw error
    throw new AuthServiceError("Không thể đổi bữa. Vui lòng thử lại sau.", 500)
  }
}

function validateWorkoutWorkload(workouts: Array<{ duration: number; exercises: Array<{ sets: number; reps: number }> }>, sessionDuration: number) {
  for (const workout of workouts) {
    const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
    const maxSets = Math.max(8, Math.floor(sessionDuration / 2))
    if (totalSets > maxSets) {
      throw new AppError(`Volume buổi tập quá cao (${totalSets} sets cho ${sessionDuration} phút). Hãy tạo lại.`, { status: 422, code: "AI_WORKLOAD_TOO_HIGH" })
    }
  }
}

// ---------------------------------------------------------------------------
// AI Chat — one-shot fitness Q&A
// ---------------------------------------------------------------------------

const FALLBACK_REPLY = "Mình là AI Coach, chỉ hỗ trợ về tập luyện, dinh dưỡng và sức khoẻ thôi nhé! 💪"

/** A draft the chat produced that the user still has to confirm. */
type ChatAction =
  | {
      type: "program_draft"
      generationId: string
      mappingRate: number
      program: MappedProgramOutput
    }
  | {
      type: "meal_plan_draft"
      generationId: string
      /** Needed to accept: the first day of the draft. */
      date: string
      days: MealPlanResponse["days"]
      shoppingList: MealPlanResponse["shoppingList"]
      notes: string
    }

const MAX_CHAT_MESSAGE_LENGTH = 2000
const MAX_HISTORY_TURNS = 6
/** How many raw entries we will even inspect, however many the client sends. */
const MAX_HISTORY_SCAN = 200

/**
 * History arrives from the client, so nothing in it can be trusted. `message`
 * was already capped but history entries were not — six oversized turns could
 * push far more text into the prompt than a single message ever could, and a
 * malformed role would be silently treated as "assistant".
 *
 * Note this only bounds the input. A client can still assert what the assistant
 * previously said, because the transcript lives on the client; removing that
 * would mean persisting conversations server-side.
 */
function sanitizeChatHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) {
    return []
  }

  const sanitized: ChatMessage[] = []

  // Validate first and keep the newest turns last, so malformed entries cannot
  // push real ones out of the window. Scanning is bounded independently so a
  // huge array still costs a fixed amount of work.
  for (const entry of history.slice(-MAX_HISTORY_SCAN)) {
    if (!entry || typeof entry !== "object") continue

    const { role, content } = entry as { role?: unknown; content?: unknown }
    if (role !== "user" && role !== "assistant") continue
    if (typeof content !== "string") continue

    const trimmed = content.trim()
    if (!trimmed) continue

    sanitized.push({ role, content: trimmed.slice(0, MAX_CHAT_MESSAGE_LENGTH) })
  }

  return sanitized.slice(-MAX_HISTORY_TURNS)
}

async function chatWithAI(
  profile: SerializedProfile,
  message: string,
  rawHistory: unknown,
): Promise<{ reply: string; action?: ChatAction }> {
  const parsedInput = parseAI(chatSchema, { message, history: rawHistory }, 400)
  message = parsedInput.message
  if (!message.trim()) {
    throw new AuthServiceError("Tin nhắn không được để trống.", 400)
  }

  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new AuthServiceError(`Tin nhắn quá dài (tối đa ${MAX_CHAT_MESSAGE_LENGTH} ký tự).`, 400)
  }

  checkChatRateLimit(profile.id)

  const history = sanitizeChatHistory(parsedInput.history)

  let systemPrompt: string
  try {
    const chatContext = await buildTraineeChatContext({ history, message, profile })
    systemPrompt = buildAIChatSystemPrompt(profile, chatContext)
  } catch {
    // Never let context building break chat — fall back to generic advice.
    systemPrompt = buildAIChatSystemPrompt(profile, null)
  }

  const ai = getAIProvider()
  const conversationHistory = history

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
  // walk all of them — but only ever produce one draft per message, since each
  // generation is slow, token-heavy and counted against a daily quota.
  let action: ChatAction | undefined
  const toolResults: AIConversationMessage[] = []

  const pushToolResult = (call: { id: string; name: string }, payload: unknown) => {
    toolResults.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify(payload),
    })
  }

  const DRAFT_NOTE = "Đây là bản nháp. Trainee phải bấm xác nhận trong app thì mới được lưu."

  for (const call of turn.toolCalls) {
    if (call.name !== CREATE_WORKOUT_PROGRAM && call.name !== CREATE_MEAL_PLAN) {
      pushToolResult(call, { ok: false, error: `Tool "${call.name}" không tồn tại.` })
      continue
    }

    if (action) {
      pushToolResult(call, { ok: false, error: "Đã tạo một bản nháp trong lượt này rồi." })
      continue
    }

    const counter = call.name === CREATE_WORKOUT_PROGRAM ? chatProgramCounter : chatMealPlanCounter
    const overLimitMessage = call.name === CREATE_WORKOUT_PROGRAM
      ? `Hôm nay đã tạo ${counter.max} chương trình từ chat rồi. Trainee có thể dùng trang "Tạo chương trình tập" nếu vẫn muốn tạo thêm.`
      : `Hôm nay đã tạo ${counter.max} thực đơn từ chat rồi. Trainee có thể dùng nút "AI gợi ý" trên trang Meals nếu vẫn muốn tạo thêm.`

    if (!counter.tryConsume(profile.id)) {
      pushToolResult(call, { ok: false, error: overLimitMessage })
      continue
    }

    try {
      // Tool results stay small — the model only needs enough to describe the
      // draft, and the full payload reaches the client through `action`.
      if (call.name === CREATE_WORKOUT_PROGRAM) {
        const result = await generateWorkoutProgram(profile, normalizeCreateProgramArgs(call.arguments))
        action = {
          type: "program_draft",
          generationId: result.generationId,
          mappingRate: result.mappingRate,
          program: result.program as MappedProgramOutput,
        }
        pushToolResult(call, {
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
          note: DRAFT_NOTE,
        })
      } else {
        const input = normalizeCreateMealPlanArgs(call.arguments)
        const result = await generateMealPlan(profile, input)
        action = {
          type: "meal_plan_draft",
          generationId: result.generationId,
          date: input.date,
          days: result.days,
          shoppingList: result.shoppingList,
          notes: result.notes,
        }
        pushToolResult(call, {
          ok: true,
          days: result.days.map((day) => ({
            date: day.date,
            totals: day.totals,
            meals: day.meals.map((meal) => ({
              type: meal.type,
              itemCount: meal.items.length,
              foods: meal.items.map((item) => item.foodName),
            })),
          })),
          note: DRAFT_NOTE,
        })
      }
    } catch (error) {
      // The attempt produced nothing, so it should not count against the budget.
      counter.release(profile.id)
      pushToolResult(call, {
        ok: false,
        error: error instanceof AuthServiceError ? error.message : "Không tạo được bản nháp.",
      })
    }
  }

  let reply = turn.text.trim() || FALLBACK_REPLY
  try {
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
    reply = followUp.text.trim() || reply
  } catch {
    // The draft action is already persisted; keep it visible when the
    // explanatory follow-up provider call fails.
    reply = action ? "Mình đã tạo bản nháp. Bạn kiểm tra nội dung và bấm xác nhận trong ứng dụng để lưu nhé." : reply
  }
  return action ? { reply, action } : { reply }
}

export {
  acceptDailyWorkout,
  acceptAIMealPlan,
  acceptAIProgram,
  acceptCoachTraineeAIProgram,
  chatWithAI,
  generateCoachTraineeWorkoutProgram,
  generateDailyWorkout,
  generateMealPlan,
  generateWorkoutProgram,
  regenerateAIMealPlanMeal,
}
