import {
  type BodyMetricEntry,
  CoachRequestStatus,
  type CoachCheckIn,
  ProgramDifficulty,
  UserRole,
  type Exercise,
  type ExerciseSet,
  type Meal,
  type Program,
  type ProgramAssignment,
  type User,
  type Workout,
  type WorkoutExercise,
  type WorkoutLog,
} from "@prisma/client"

import { AuthServiceError, type SerializedProfile } from "./auth.service"
import { prisma } from "../lib/prisma"

type WorkoutRecord = Workout & {
  exercises: Array<
    WorkoutExercise & {
      exercise: Exercise
      sets: ExerciseSet[]
    }
  >
}

type WorkoutWithProgramRecord = WorkoutRecord & {
  program: Program | null
}

type ProgramRecord = Program & {
  assignments: Array<
    ProgramAssignment & {
      user: User
    }
  >
  workouts: WorkoutRecord[]
}

type WorkoutLogRecord = WorkoutLog & {
  workout: WorkoutRecord | null
}

type BodyMetricRecord = BodyMetricEntry & {
  coach: User | null
}

type CoachCheckInRecord = CoachCheckIn & {
  coach: User
}

type PersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    exerciseId: string
    reps: number
    restTime?: number
    sets: number
  }>
  name: string
  notes?: string | null
  scheduledDay?: number
}

type NormalizedPersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    exerciseId: string
    reps: number
    restTime?: number
    sets: number
  }>
  name: string
  notes?: string
  scheduledDay?: number
}

const DEFAULT_CALORIE_TARGET = 2500
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DEFAULT_EXERCISES = [
  { equipment: "Barbell", muscleGroup: "Chest", name: "Bench Press" },
  { equipment: "Barbell", muscleGroup: "Legs", name: "Back Squat" },
  { equipment: "Barbell", muscleGroup: "Back", name: "Deadlift" },
  { equipment: "Dumbbell", muscleGroup: "Shoulders", name: "Shoulder Press" },
  { equipment: "Cable", muscleGroup: "Back", name: "Lat Pulldown" },
  { equipment: "Machine", muscleGroup: "Legs", name: "Leg Press" },
  { equipment: "Dumbbell", muscleGroup: "Chest", name: "Incline Dumbbell Press" },
  { equipment: "Cable", muscleGroup: "Arms", name: "Tricep Pushdown" },
  { equipment: "Dumbbell", muscleGroup: "Arms", name: "Bicep Curl" },
  { equipment: "Bodyweight", muscleGroup: "Core", name: "Plank" },
]

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function assertCoach(profile: SerializedProfile) {
  if (profile.role !== UserRole.coach) {
    throw new AuthServiceError("Chỉ coach mới có quyền truy cập dữ liệu này.", 403)
  }
}

function assertTrainee(profile: SerializedProfile) {
  if (profile.role !== UserRole.trainee) {
    throw new AuthServiceError("Chỉ trainee mới có quyền truy cập dữ liệu này.", 403)
  }
}

function toDateRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(-1)

  return { end, start }
}

function toRecentWindow(days: number) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { end, start }
}

function serializeExercise(exercise: Exercise) {
  return {
    equipment: exercise.equipment ?? undefined,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
  }
}

function serializeExerciseSet(set: ExerciseSet) {
  return {
    actualReps: set.actualReps ?? undefined,
    completed: set.completed,
    id: set.id,
    notes: set.notes ?? undefined,
    rir: set.rir ?? undefined,
    setNumber: set.setNumber,
    targetReps: set.targetReps,
    weight: set.weight ?? undefined,
  }
}

function serializeWorkout(workout: WorkoutRecord, options?: { isPersonal?: boolean }) {
  return {
    duration: workout.duration ?? undefined,
    exercises: workout.exercises
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((exercise) => ({
        exercise: serializeExercise(exercise.exercise),
        id: exercise.id,
        notes: exercise.notes ?? undefined,
        restTime: exercise.restTime ?? undefined,
        sets: exercise.sets
          .slice()
          .sort((left, right) => left.setNumber - right.setNumber)
          .map(serializeExerciseSet),
      })),
    id: workout.id,
    isPersonal: options?.isPersonal ?? false,
    name: workout.name,
    notes: workout.notes ?? undefined,
    scheduledDay: workout.scheduledDay ?? undefined,
  }
}

function serializeMeal(meal: Meal) {
  return {
    calories: meal.calories,
    carbs: meal.carbs ?? undefined,
    fat: meal.fat ?? undefined,
    id: meal.id,
    name: meal.name,
    protein: meal.protein ?? undefined,
    time: meal.recordedAt,
    type: meal.type,
  }
}

function serializeProgram(program: ProgramRecord) {
  return {
    assignedTo: program.assignments.map((assignment) => assignment.userId),
    assignedTrainees: program.assignments.map((assignment) => ({
      avatar: assignment.user.avatar,
      email: assignment.user.email,
      fitnessGoals: assignment.user.fitnessGoals,
      id: assignment.user.id,
      name: assignment.user.name,
    })),
    createdAt: program.createdAt,
    createdBy: program.createdById,
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts
      .slice()
      .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
      .map((workout) => serializeWorkout(workout)),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function serializeCoachRequest(request: {
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: User
  traineeId: string
}) {
  return {
    coachId: request.coachId,
    createdAt: request.createdAt,
    id: request.id,
    status: request.status,
    trainee: {
      avatar: request.trainee.avatar,
      email: request.trainee.email,
      fitnessGoals: request.trainee.fitnessGoals,
      id: request.trainee.id,
      name: request.trainee.name,
    },
    traineeId: request.traineeId,
  }
}

function serializeBodyMetricEntry(entry: BodyMetricRecord) {
  return {
    armCm: entry.armCm ?? undefined,
    bodyFatPct: entry.bodyFatPct ?? undefined,
    chestCm: entry.chestCm ?? undefined,
    coachId: entry.coachId ?? undefined,
    coachName: entry.coach?.name ?? undefined,
    createdAt: entry.createdAt,
    hipsCm: entry.hipsCm ?? undefined,
    id: entry.id,
    note: entry.note ?? undefined,
    recordedAt: entry.recordedAt,
    thighCm: entry.thighCm ?? undefined,
    waistCm: entry.waistCm ?? undefined,
    weightKg: entry.weightKg ?? undefined,
  }
}

function serializeCoachCheckIn(entry: CoachCheckInRecord) {
  return {
    adherenceScore: entry.adherenceScore ?? undefined,
    checkInDate: entry.checkInDate,
    coachId: entry.coachId,
    coachName: entry.coach.name,
    createdAt: entry.createdAt,
    energyScore: entry.energyScore ?? undefined,
    feedback: entry.feedback,
    id: entry.id,
    moodScore: entry.moodScore ?? undefined,
    nextFocus: entry.nextFocus ?? undefined,
    recoveryScore: entry.recoveryScore ?? undefined,
    summary: entry.summary ?? undefined,
  }
}

function serializeWorkoutLog(log: WorkoutLogRecord) {
  const snapshotWorkout =
    log.workoutSnapshot && typeof log.workoutSnapshot === "object" && !Array.isArray(log.workoutSnapshot)
      ? (log.workoutSnapshot as { duration?: number; id?: string; name?: string; notes?: string; scheduledDay?: number })
      : null

  const snapshotExercises =
    Array.isArray(log.exerciseSnapshot)
      ? (log.exerciseSnapshot as ReturnType<typeof serializeWorkout>["exercises"])
      : null

  return {
    completedAt: log.completedAt,
    exercises: snapshotExercises ?? (log.workout ? serializeWorkout(log.workout).exercises : []),
    id: log.id,
    notes: log.notes ?? undefined,
    startedAt: log.startedAt,
    totalVolume: log.totalVolume ?? undefined,
    workout: log.workout
      ? serializeWorkout(log.workout)
      : {
          duration: snapshotWorkout?.duration,
          exercises: snapshotExercises ?? [],
          id: snapshotWorkout?.id ?? log.workoutId ?? log.id,
          name: snapshotWorkout?.name ?? "Workout",
          notes: snapshotWorkout?.notes,
          scheduledDay: snapshotWorkout?.scheduledDay,
        },
  }
}

function buildWeeklyCaloriesChart(meals: Array<Pick<Meal, "calories" | "recordedAt">>, targetCalories = DEFAULT_CALORIE_TARGET) {
  const { start } = toRecentWindow(7)
  const totals = new Map<string, number>()

  meals.forEach((meal) => {
    const key = meal.recordedAt.toISOString().slice(0, 10)
    totals.set(key, (totals.get(key) ?? 0) + meal.calories)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    const key = date.toISOString().slice(0, 10)

    return {
      calories: totals.get(key) ?? 0,
      day: DAY_LABELS[date.getDay()],
      target: targetCalories,
    }
  })
}

function calculateWorkoutVolume(exercises: Array<{ sets?: Array<{ actualReps?: number; completed?: boolean; targetReps?: number; weight?: number }> }>) {
  return exercises.reduce((volumeTotal, exercise) => {
    const setVolume = (exercise.sets ?? []).reduce((setTotal, set) => {
      if (!set.completed || !set.weight) {
        return setTotal
      }

      const reps = set.actualReps ?? set.targetReps ?? 0
      return setTotal + set.weight * reps
    }, 0)

    return volumeTotal + setVolume
  }, 0)
}

async function assertCoachOwnsTrainee(coachId: string, traineeId: string) {
  const db = ensurePrisma()
  const trainee = await db.user.findFirst({
    where: {
      coachId,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new AuthServiceError("Không tìm thấy trainee thuộc coach này.", 404)
  }

  return trainee
}

async function assertCoachOwnsProgram(coachId: string, programId: string) {
  const db = ensurePrisma()
  const program = await db.program.findFirst({
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
    where: {
      createdById: coachId,
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  return program as ProgramRecord
}

function sanitizeOptionalMeasurement(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return undefined
  }

  return Number(value)
}

function sanitizeScore(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return undefined
  }

  return Math.max(1, Math.min(10, Math.round(value)))
}

function normalizePhoneNumber(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

async function ensureDefaultExercises() {
  const db = ensurePrisma()
  const currentCount = await db.exercise.count()

  if (currentCount === 0) {
    await db.exercise.createMany({
      data: DEFAULT_EXERCISES,
    })
  }

  return db.exercise.findMany({
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })
}

async function listExercises() {
  const exercises = await ensureDefaultExercises()
  return exercises.map(serializeExercise)
}

async function listMealsForUser(profile: SerializedProfile, date = new Date()) {
  const db = ensurePrisma()
  const { end, start } = toDateRange(date)
  const recentWindow = toRecentWindow(7)
  const targetCalories = profile.dailyCalorieGoal ?? DEFAULT_CALORIE_TARGET

  const [meals, weeklyMeals] = await Promise.all([
    db.meal.findMany({
      orderBy: {
        recordedAt: "asc",
      },
      where: {
        recordedAt: {
          gte: start,
          lte: end,
        },
        userId: profile.id,
      },
    }),
    db.meal.findMany({
      orderBy: {
        recordedAt: "asc",
      },
      select: {
        calories: true,
        recordedAt: true,
      },
      where: {
        recordedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        userId: profile.id,
      },
    }),
  ])

  const serializedMeals = meals.map(serializeMeal)
  const totalCalories = serializedMeals.reduce((total, meal) => total + meal.calories, 0)

  return {
    dailyNutrition: {
      date: start,
      meals: serializedMeals,
      targetCalories,
      totalCalories,
    },
    meals: serializedMeals,
    weeklyCalories: buildWeeklyCaloriesChart(weeklyMeals, targetCalories),
  }
}

async function createMealForUser(
  profile: SerializedProfile,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string | null
    type: Meal["type"]
  },
) {
  const db = ensurePrisma()

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên bữa ăn không được để trống.")
  }

  const meal = await db.meal.create({
    data: {
      calories: Math.max(0, Math.round(input.calories)),
      carbs: input.carbs != null ? Math.round(input.carbs) : undefined,
      fat: input.fat != null ? Math.round(input.fat) : undefined,
      name: input.name.trim(),
      protein: input.protein != null ? Math.round(input.protein) : undefined,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      type: input.type,
      userId: profile.id,
    },
  })

  return serializeMeal(meal)
}

async function updateMealForUser(
  profile: SerializedProfile,
  mealId: string,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string | null
    type: Meal["type"]
  },
) {
  const db = ensurePrisma()
  const meal = await db.meal.findFirst({
    where: {
      id: mealId,
      userId: profile.id,
    },
  })

  if (!meal) {
    throw new AuthServiceError("Không tìm thấy bữa ăn.", 404)
  }

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên bữa ăn không được để trống.")
  }

  const updatedMeal = await db.meal.update({
    data: {
      calories: Math.max(0, Math.round(input.calories)),
      carbs: input.carbs != null ? Math.round(input.carbs) : undefined,
      fat: input.fat != null ? Math.round(input.fat) : undefined,
      name: input.name.trim(),
      protein: input.protein != null ? Math.round(input.protein) : undefined,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : meal.recordedAt,
      type: input.type,
    },
    where: {
      id: mealId,
    },
  })

  return serializeMeal(updatedMeal)
}

async function deleteMealForUser(profile: SerializedProfile, mealId: string) {
  const db = ensurePrisma()
  const meal = await db.meal.findFirst({
    where: {
      id: mealId,
      userId: profile.id,
    },
  })

  if (!meal) {
    throw new AuthServiceError("Không tìm thấy bữa ăn.", 404)
  }

  await db.meal.delete({
    where: {
      id: mealId,
    },
  })

  return {
    deleted: true,
    id: mealId,
  }
}

async function listWorkoutsForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  const assignments = await db.programAssignment.findMany({
    include: {
      program: {
        include: {
          workouts: {
            include: {
              exercises: {
                include: {
                  exercise: true,
                  sets: {
                    orderBy: {
                      setNumber: "asc",
                    },
                  },
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
            orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
    where: {
      userId: profile.id,
    },
  })

  const workoutMap = new Map<string, WorkoutRecord>()
  const personalWorkoutIds = new Set<string>()

  assignments.forEach((assignment) => {
    const isPersonalProgram = assignment.program.createdById === profile.id

    ;(assignment.program.workouts as WorkoutRecord[]).forEach((workout) => {
      workoutMap.set(workout.id, workout)

      if (isPersonalProgram) {
        personalWorkoutIds.add(workout.id)
      }
    })
  })

  const serializedWorkouts = Array.from(workoutMap.values())
    .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
    .map((workout) => serializeWorkout(workout, { isPersonal: personalWorkoutIds.has(workout.id) }))

  const recentLogs = await db.workoutLog.findMany({
    include: {
      workout: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 5,
    where: {
      userId: profile.id,
    },
  })

  const schedule = DAY_LABELS.reduce<Record<number, ReturnType<typeof serializeWorkout> | null>>((accumulator, _label, index) => {
    const workout = serializedWorkouts.find((item) => item.scheduledDay === index)
    accumulator[index] = workout ?? null
    return accumulator
  }, {})

  return {
    recentLogs: recentLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    schedule,
    todayWorkout: schedule[new Date().getDay()] ?? null,
    workouts: serializedWorkouts,
  }
}

async function getWorkoutDetailForTrainee(profile: SerializedProfile, workoutId: string) {
  const db = ensurePrisma()
  const workout = await db.workout.findFirst({
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: {
            orderBy: {
              setNumber: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
      program: true,
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  return serializeWorkout(workout as WorkoutWithProgramRecord, {
    isPersonal: workout.program?.createdById === profile.id,
  })
}

async function createWorkoutLogForTrainee(
  profile: SerializedProfile,
  workoutId: string,
  input: {
    completedAt?: string | null
    exercises: ReturnType<typeof serializeWorkout>["exercises"]
    notes?: string | null
    startedAt?: string | null
  },
) {
  const db = ensurePrisma()
  const workout = await db.workout.findFirst({
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: {
            orderBy: {
              setNumber: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  const serializedWorkout = serializeWorkout(workout as WorkoutRecord)
  const totalVolume = calculateWorkoutVolume(input.exercises)

  const log = await db.workoutLog.create({
    data: {
      completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
      exerciseSnapshot: input.exercises,
      notes: input.notes?.trim() || undefined,
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      totalVolume,
      userId: profile.id,
      workoutId: workout.id,
      workoutSnapshot: {
        duration: serializedWorkout.duration,
        id: serializedWorkout.id,
        name: serializedWorkout.name,
        notes: serializedWorkout.notes,
        scheduledDay: serializedWorkout.scheduledDay,
      },
    },
    include: {
      workout: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  })

  return serializeWorkoutLog(log as WorkoutLogRecord)
}

async function normalizePersonalWorkoutInput(input: PersonalWorkoutInput): Promise<NormalizedPersonalWorkoutInput> {
  const db = ensurePrisma()
  const workoutName = input.name.trim()

  if (!workoutName) {
    throw new AuthServiceError("Tên buổi tập không được để trống.")
  }

  if (input.exercises.length === 0) {
    throw new AuthServiceError("Buổi tập cần ít nhất một bài tập.", 400)
  }

  if (input.scheduledDay != null && (input.scheduledDay < 0 || input.scheduledDay > 6)) {
    throw new AuthServiceError("Ngày tập không hợp lệ.", 400)
  }

  if (input.exercises.some((exercise) => !exercise.exerciseId)) {
    throw new AuthServiceError("Mỗi dòng bài tập cần có exercise hợp lệ.", 400)
  }

  const exerciseIds = Array.from(new Set(input.exercises.map((exercise) => exercise.exerciseId)))
  const validExerciseCount = await db.exercise.count({
    where: {
      id: {
        in: exerciseIds,
      },
    },
  })

  if (validExerciseCount !== exerciseIds.length) {
    throw new AuthServiceError("Có bài tập không tồn tại trong thư viện.", 400)
  }

  return {
    duration: input.duration ? Math.max(1, Math.round(input.duration)) : undefined,
    exercises: input.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      reps: Math.max(1, Math.round(exercise.reps)),
      restTime: exercise.restTime ? Math.max(0, Math.round(exercise.restTime)) : undefined,
      sets: Math.max(1, Math.round(exercise.sets)),
    })),
    name: workoutName,
    notes: input.notes?.trim() || undefined,
    scheduledDay: typeof input.scheduledDay === "number" ? input.scheduledDay : undefined,
  }
}

function buildPersonalWorkoutExerciseCreateData(exercises: NormalizedPersonalWorkoutInput["exercises"]) {
  return exercises.map((exercise, exerciseIndex) => ({
    exerciseId: exercise.exerciseId,
    order: exerciseIndex + 1,
    restTime: exercise.restTime,
    sets: {
      create: Array.from({ length: exercise.sets }, (_value, setIndex) => ({
        setNumber: setIndex + 1,
        targetReps: exercise.reps,
      })),
    },
  }))
}

async function createPersonalWorkoutForTrainee(
  profile: SerializedProfile,
  input: PersonalWorkoutInput,
) {
  const db = ensurePrisma()
  assertTrainee(profile)
  const normalizedInput = await normalizePersonalWorkoutInput(input)

  const program = await db.program.create({
    data: {
      assignments: {
        create: {
          userId: profile.id,
        },
      },
      createdById: profile.id,
      description: "Personal workout created by trainee.",
      difficulty: ProgramDifficulty.beginner,
      duration: 1,
      name: normalizedInput.name,
      workouts: {
        create: {
          duration: normalizedInput.duration,
          exercises: {
            create: buildPersonalWorkoutExerciseCreateData(normalizedInput.exercises),
          },
          name: normalizedInput.name,
          notes: normalizedInput.notes,
          scheduledDay: normalizedInput.scheduledDay,
        },
      },
      workoutsPerWeek: 1,
    },
    include: {
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  })

  const workout = program.workouts[0]

  if (!workout) {
    throw new AuthServiceError("Không thể tạo buổi tập.", 500)
  }

  return serializeWorkout(workout as WorkoutRecord, {
    isPersonal: true,
  })
}

async function updatePersonalWorkoutForTrainee(
  profile: SerializedProfile,
  workoutId: string,
  input: PersonalWorkoutInput,
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const normalizedInput = await normalizePersonalWorkoutInput(input)
  const existingWorkout = await db.workout.findFirst({
    select: {
      id: true,
      programId: true,
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
        createdById: profile.id,
      },
    },
  })

  if (!existingWorkout) {
    throw new AuthServiceError("Không tìm thấy lịch tập cá nhân.", 404)
  }

  const updatedWorkout = await db.$transaction(async (tx) => {
    await tx.workoutExercise.deleteMany({
      where: {
        workoutId: existingWorkout.id,
      },
    })

    const workout = await tx.workout.update({
      data: {
        duration: normalizedInput.duration ?? null,
        exercises: {
          create: buildPersonalWorkoutExerciseCreateData(normalizedInput.exercises),
        },
        name: normalizedInput.name,
        notes: normalizedInput.notes ?? null,
        scheduledDay: normalizedInput.scheduledDay ?? null,
      },
      include: {
        exercises: {
          include: {
            exercise: true,
            sets: {
              orderBy: {
                setNumber: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
      where: {
        id: existingWorkout.id,
      },
    })

    if (existingWorkout.programId) {
      await tx.program.update({
        data: {
          name: normalizedInput.name,
        },
        where: {
          id: existingWorkout.programId,
        },
      })
    }

    return workout
  })

  return serializeWorkout(updatedWorkout as WorkoutRecord, {
    isPersonal: true,
  })
}

async function deletePersonalWorkoutForTrainee(profile: SerializedProfile, workoutId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const workout = await db.workout.findFirst({
    select: {
      id: true,
      programId: true,
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
        createdById: profile.id,
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy lịch tập cá nhân.", 404)
  }

  await db.$transaction(async (tx) => {
    await tx.workout.delete({
      where: {
        id: workout.id,
      },
    })

    if (workout.programId) {
      const remainingWorkoutCount = await tx.workout.count({
        where: {
          programId: workout.programId,
        },
      })

      if (remainingWorkoutCount === 0) {
        await tx.program.delete({
          where: {
            id: workout.programId,
          },
        })
      }
    }
  })

  return {
    deleted: true,
    id: workout.id,
  }
}

async function listAvailableCoachesForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const [coaches, requests] = await Promise.all([
    db.user.findMany({
      include: {
        _count: {
          select: {
            trainees: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        role: UserRole.coach,
      },
    }),
    db.coachRequest.findMany({
      where: {
        traineeId: profile.id,
      },
    }),
  ])

  const requestByCoach = new Map(requests.map((request) => [request.coachId, request]))

  return coaches.map((coach) => {
    const request = requestByCoach.get(coach.id)
    const requestStatus = profile.coachId === coach.id ? "connected" : request?.status ?? "none"

    return {
      activeTrainees: coach._count.trainees,
      avatar: coach.avatar,
      createdAt: coach.createdAt,
      email: coach.email,
      fitnessGoals: coach.fitnessGoals,
      id: coach.id,
      name: coach.name,
      requestId: request?.id,
      requestStatus,
    }
  })
}

async function createCoachRequestForTrainee(profile: SerializedProfile, coachId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  if (profile.coachId) {
    throw new AuthServiceError("Bạn đã được gán coach. Hãy ngắt kết nối trước khi gửi request mới.", 400)
  }

  const coach = await db.user.findFirst({
    where: {
      id: coachId,
      role: UserRole.coach,
    },
  })

  if (!coach) {
    throw new AuthServiceError("Không tìm thấy coach.", 404)
  }

  const existingRequest = await db.coachRequest.findUnique({
    where: {
      traineeId_coachId: {
        coachId,
        traineeId: profile.id,
      },
    },
  })

  if (existingRequest?.status === CoachRequestStatus.pending) {
    return {
      request: {
        coachId: existingRequest.coachId,
        createdAt: existingRequest.createdAt,
        id: existingRequest.id,
        requestStatus: existingRequest.status,
        traineeId: existingRequest.traineeId,
      },
    }
  }

  if (existingRequest?.status === CoachRequestStatus.approved) {
    throw new AuthServiceError("Coach request này đã được phê duyệt.", 400)
  }

  const request =
    existingRequest != null
      ? await db.coachRequest.update({
          data: {
            status: CoachRequestStatus.pending,
          },
          where: {
            id: existingRequest.id,
          },
        })
      : await db.coachRequest.create({
          data: {
            coachId,
            traineeId: profile.id,
          },
        })

  return {
    request: {
      coachId: request.coachId,
      createdAt: request.createdAt,
      id: request.id,
      requestStatus: request.status,
      traineeId: request.traineeId,
    },
  }
}

async function listCoachPrograms(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      createdById: profile.id,
    },
  })

  return programs.map((program) => serializeProgram(program as ProgramRecord))
}

async function getCoachProgramDetail(profile: SerializedProfile, programId: string) {
  assertCoach(profile)
  const db = ensurePrisma()
  const program = await db.program.findFirst({
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  return serializeProgram(program as ProgramRecord)
}

async function createCoachProgram(
  profile: SerializedProfile,
  input: {
    assignToUserIds?: string[]
    description?: string | null
    difficulty: ProgramDifficulty
    duration: number
    name: string
    workouts: Array<{
      duration?: number
      exercises: Array<{
        exerciseId: string
        reps: number
        restTime?: number
        sets: number
      }>
      name: string
      scheduledDay?: number
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.")
  }

  const assignToUserIds = Array.from(new Set((input.assignToUserIds ?? []).filter(Boolean)))

  if (assignToUserIds.length > 0) {
    const validTrainees = await db.user.count({
      where: {
        coachId: profile.id,
        id: {
          in: assignToUserIds,
        },
        role: UserRole.trainee,
      },
    })

    if (validTrainees !== assignToUserIds.length) {
      throw new AuthServiceError("Chỉ có thể gán chương trình cho trainee thuộc coach này.", 400)
    }
  }

  const program = await db.program.create({
    data: {
      assignments:
        assignToUserIds.length > 0
          ? {
              create: assignToUserIds.map((userId) => ({
                userId,
              })),
            }
          : undefined,
      createdById: profile.id,
      description: input.description?.trim() || undefined,
      difficulty: input.difficulty,
      duration: Math.max(1, Math.round(input.duration)),
      name: input.name.trim(),
      workouts: {
        create: input.workouts.map((workout, workoutIndex) => ({
          duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
          exercises: {
            create: workout.exercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              order: exerciseIndex + 1,
              restTime: exercise.restTime ? Math.max(0, Math.round(exercise.restTime)) : undefined,
              sets: {
                create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                  setNumber: setIndex + 1,
                  targetReps: Math.max(1, Math.round(exercise.reps)),
                })),
              },
            })),
          },
          name: workout.name.trim() || `Day ${workoutIndex + 1}`,
          scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
        })),
      },
      workoutsPerWeek: input.workouts.length,
    },
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  return serializeProgram(program as ProgramRecord)
}

async function updateCoachProgram(
  profile: SerializedProfile,
  programId: string,
  input: {
    assignToUserIds?: string[]
    description?: string | null
    difficulty: ProgramDifficulty
    duration: number
    name: string
    workouts: Array<{
      duration?: number
      exercises: Array<{
        exerciseId: string
        reps: number
        restTime?: number
        sets: number
      }>
      name: string
      scheduledDay?: number
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    select: {
      id: true,
    },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.")
  }

  const assignToUserIds = Array.from(new Set((input.assignToUserIds ?? []).filter(Boolean)))

  if (assignToUserIds.length > 0) {
    const validTrainees = await db.user.count({
      where: {
        coachId: profile.id,
        id: {
          in: assignToUserIds,
        },
        role: UserRole.trainee,
      },
    })

    if (validTrainees !== assignToUserIds.length) {
      throw new AuthServiceError("Chỉ có thể gán chương trình cho trainee thuộc coach này.", 400)
    }
  }

  const program = await db.program.update({
    data: {
      assignments: {
        create: assignToUserIds.map((userId) => ({
          userId,
        })),
        deleteMany: {},
      },
      description: input.description?.trim() || undefined,
      difficulty: input.difficulty,
      duration: Math.max(1, Math.round(input.duration)),
      name: input.name.trim(),
      workouts: {
        create: input.workouts.map((workout, workoutIndex) => ({
          duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
          exercises: {
            create: workout.exercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              order: exerciseIndex + 1,
              restTime: exercise.restTime ? Math.max(0, Math.round(exercise.restTime)) : undefined,
              sets: {
                create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                  setNumber: setIndex + 1,
                  targetReps: Math.max(1, Math.round(exercise.reps)),
                })),
              },
            })),
          },
          name: workout.name.trim() || `Day ${workoutIndex + 1}`,
          scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
        })),
        deleteMany: {},
      },
      workoutsPerWeek: input.workouts.length,
    },
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
    where: {
      id: existingProgram.id,
    },
  })

  return serializeProgram(program as ProgramRecord)
}

async function deleteCoachProgram(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    select: {
      id: true,
    },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  await db.program.delete({
    where: {
      id: existingProgram.id,
    },
  })

  return {
    deleted: true,
    id: existingProgram.id,
  }
}

async function assignCoachProgramToTrainee(profile: SerializedProfile, programId: string, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  await Promise.all([assertCoachOwnsProgram(profile.id, programId), assertCoachOwnsTrainee(profile.id, traineeId)])

  const assignment = await db.programAssignment.upsert({
    create: {
      programId,
      userId: traineeId,
    },
    update: {},
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  return {
    assigned: true,
    programId: assignment.programId,
    traineeId: assignment.userId,
  }
}

async function unassignCoachProgramFromTrainee(profile: SerializedProfile, programId: string, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  await Promise.all([assertCoachOwnsProgram(profile.id, programId), assertCoachOwnsTrainee(profile.id, traineeId)])

  const existingAssignment = await db.programAssignment.findUnique({
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  if (!existingAssignment) {
    throw new AuthServiceError("Trainee này chưa được gán vào chương trình.", 404)
  }

  await db.programAssignment.delete({
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  return {
    deleted: true,
    programId,
    traineeId,
  }
}

async function createBodyMetricForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  input: {
    armCm?: number | null
    bodyFatPct?: number | null
    chestCm?: number | null
    hipsCm?: number | null
    note?: string | null
    recordedAt?: string | null
    thighCm?: number | null
    waistCm?: number | null
    weightKg?: number | null
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  await assertCoachOwnsTrainee(profile.id, traineeId)

  const metricPayload = {
    armCm: sanitizeOptionalMeasurement(input.armCm),
    bodyFatPct: sanitizeOptionalMeasurement(input.bodyFatPct),
    chestCm: sanitizeOptionalMeasurement(input.chestCm),
    hipsCm: sanitizeOptionalMeasurement(input.hipsCm),
    thighCm: sanitizeOptionalMeasurement(input.thighCm),
    waistCm: sanitizeOptionalMeasurement(input.waistCm),
    weightKg: sanitizeOptionalMeasurement(input.weightKg),
  }

  const hasMetricValue = Object.values(metricPayload).some((value) => value != null)
  const note = input.note?.trim() || undefined

  if (!hasMetricValue && !note) {
    throw new AuthServiceError("Vui lòng nhập ít nhất một chỉ số hoặc ghi chú.", 400)
  }

  const entry = await db.bodyMetricEntry.create({
    data: {
      ...metricPayload,
      coachId: profile.id,
      note,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      traineeId,
    },
    include: {
      coach: true,
    },
  })

  return serializeBodyMetricEntry(entry as BodyMetricRecord)
}

async function listBodyMetricsForCurrentTrainee(
  profile: SerializedProfile,
  options?: {
    days?: number
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const requestedDays = options?.days ?? 30
  const normalizedDays = requestedDays === 90 || requestedDays === 365 ? requestedDays : 30
  const window = toRecentWindow(normalizedDays)

  const entries = await db.bodyMetricEntry.findMany({
    include: {
      coach: true,
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    where: {
      recordedAt: {
        gte: window.start,
        lte: window.end,
      },
      traineeId: profile.id,
      weightKg: {
        not: null,
      },
    },
  })

  return entries.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord))
}

async function createBodyMetricForCurrentTrainee(
  profile: SerializedProfile,
  input: {
    note?: string | null
    recordedAt?: string | null
    weightKg?: number | null
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const weightKg = sanitizeOptionalMeasurement(input.weightKg)
  const note = input.note?.trim() || undefined

  if (weightKg == null && !note) {
    throw new AuthServiceError("Vui lòng nhập cân nặng hoặc ghi chú.", 400)
  }

  const entry = await db.bodyMetricEntry.create({
    data: {
      note,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      traineeId: profile.id,
      weightKg,
    },
    include: {
      coach: true,
    },
  })

  return serializeBodyMetricEntry(entry as BodyMetricRecord)
}

async function resetCurrentTraineeData(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const [meals, workoutLogs, bodyMetrics, coachCheckIns, personalPrograms] = await db.$transaction([
    db.meal.deleteMany({
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.deleteMany({
      where: {
        userId: profile.id,
      },
    }),
    db.bodyMetricEntry.deleteMany({
      where: {
        traineeId: profile.id,
      },
    }),
    db.coachCheckIn.deleteMany({
      where: {
        traineeId: profile.id,
      },
    }),
    db.program.deleteMany({
      where: {
        createdById: profile.id,
      },
    }),
  ])

  return {
    message: "Đã reset dữ liệu tracking của trainee.",
    resetCounts: {
      bodyMetrics: bodyMetrics.count,
      coachCheckIns: coachCheckIns.count,
      meals: meals.count,
      personalPrograms: personalPrograms.count,
      workoutLogs: workoutLogs.count,
    },
  }
}

async function createCoachCheckInForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  input: {
    adherenceScore?: number | null
    checkInDate?: string | null
    energyScore?: number | null
    feedback: string
    moodScore?: number | null
    nextFocus?: string | null
    recoveryScore?: number | null
    summary?: string | null
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  await assertCoachOwnsTrainee(profile.id, traineeId)

  const feedback = input.feedback.trim()

  if (!feedback) {
    throw new AuthServiceError("Feedback không được để trống.", 400)
  }

  const checkIn = await db.coachCheckIn.create({
    data: {
      adherenceScore: sanitizeScore(input.adherenceScore),
      checkInDate: input.checkInDate ? new Date(input.checkInDate) : new Date(),
      coachId: profile.id,
      energyScore: sanitizeScore(input.energyScore),
      feedback,
      moodScore: sanitizeScore(input.moodScore),
      nextFocus: input.nextFocus?.trim() || undefined,
      recoveryScore: sanitizeScore(input.recoveryScore),
      summary: input.summary?.trim() || undefined,
      traineeId,
    },
    include: {
      coach: true,
    },
  })

  return serializeCoachCheckIn(checkIn as CoachCheckInRecord)
}

async function listCoachTrainees(profile: SerializedProfile, options?: { phone?: string }) {
  assertCoach(profile)
  const db = ensurePrisma()
  const trainees = await db.user.findMany({
    include: {
      _count: {
        select: {
          programAssignments: true,
          workoutLogs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      coachId: profile.id,
      role: UserRole.trainee,
    },
  })

  const phoneQuery = normalizePhoneNumber(options?.phone)
  const filteredTrainees = phoneQuery
    ? trainees.filter((trainee) => normalizePhoneNumber(trainee.phone).includes(phoneQuery))
    : trainees

  const traineeIds = filteredTrainees.map((trainee) => trainee.id)
  const recentWindow = toRecentWindow(7)
  const [recentLogs, recentMetrics, recentCheckIns] = traineeIds.length
    ? await Promise.all([
        db.workoutLog.findMany({
          select: {
            userId: true,
          },
          where: {
            startedAt: {
              gte: recentWindow.start,
              lte: recentWindow.end,
            },
            userId: {
              in: traineeIds,
            },
          },
        }),
        db.bodyMetricEntry.findMany({
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          select: {
            recordedAt: true,
            traineeId: true,
            weightKg: true,
          },
          where: {
            traineeId: {
              in: traineeIds,
            },
          },
        }),
        db.coachCheckIn.findMany({
          orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
          select: {
            checkInDate: true,
            traineeId: true,
          },
          where: {
            traineeId: {
              in: traineeIds,
            },
          },
        }),
      ])
    : [[], [], []]

  const thisWeekByUser = recentLogs.reduce<Map<string, number>>((accumulator, log) => {
    accumulator.set(log.userId, (accumulator.get(log.userId) ?? 0) + 1)
    return accumulator
  }, new Map())

  const latestMetricByUser = recentMetrics.reduce<Map<string, { recordedAt: Date; weightKg: number | null }>>(
    (accumulator, metric) => {
      if (!accumulator.has(metric.traineeId)) {
        accumulator.set(metric.traineeId, {
          recordedAt: metric.recordedAt,
          weightKg: metric.weightKg,
        })
      }

      return accumulator
    },
    new Map(),
  )

  const latestCheckInByUser = recentCheckIns.reduce<Map<string, Date>>((accumulator, checkIn) => {
    if (!accumulator.has(checkIn.traineeId)) {
      accumulator.set(checkIn.traineeId, checkIn.checkInDate)
    }

    return accumulator
  }, new Map())

  return filteredTrainees.map((trainee) => ({
    avatar: trainee.avatar,
    createdAt: trainee.createdAt,
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    lastCheckInAt: latestCheckInByUser.get(trainee.id),
    latestWeightKg: latestMetricByUser.get(trainee.id)?.weightKg ?? undefined,
    name: trainee.name,
    phone: trainee.phone ?? undefined,
    programCount: trainee._count.programAssignments,
    thisWeekWorkouts: thisWeekByUser.get(trainee.id) ?? 0,
    totalWorkoutLogs: trainee._count.workoutLogs,
  }))
}

async function getCoachTraineeDetail(profile: SerializedProfile, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const trainee = await db.user.findFirst({
    include: {
      _count: {
        select: {
          programAssignments: true,
          workoutLogs: true,
        },
      },
      programAssignments: {
        include: {
          program: {
            include: {
              assignments: {
                include: {
                  user: true,
                },
              },
              workouts: {
                include: {
                  exercises: {
                    include: {
                      exercise: true,
                      sets: {
                        orderBy: {
                          setNumber: "asc",
                        },
                      },
                    },
                    orderBy: {
                      order: "asc",
                    },
                  },
                },
                orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
      },
      workoutLogs: {
        include: {
          workout: {
            include: {
              exercises: {
                include: {
                  exercise: true,
                  sets: {
                    orderBy: {
                      setNumber: "asc",
                    },
                  },
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 10,
      },
    },
    where: {
      coachId: profile.id,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new AuthServiceError("Không tìm thấy trainee.", 404)
  }

  const recentWindow = toRecentWindow(7)
  const last30Days = toRecentWindow(30)
  const [thisWeekWorkouts, progressLogs, bodyMetrics, checkIns] = await Promise.all([
    db.workoutLog.count({
      where: {
        startedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        userId: trainee.id,
      },
    }),
    db.workoutLog.findMany({
      orderBy: {
        startedAt: "desc",
      },
      select: {
        startedAt: true,
        totalVolume: true,
      },
      where: {
        startedAt: {
          gte: last30Days.start,
          lte: last30Days.end,
        },
        userId: trainee.id,
      },
    }),
    db.bodyMetricEntry.findMany({
      include: {
        coach: true,
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      where: {
        traineeId: trainee.id,
      },
    }),
    db.coachCheckIn.findMany({
      include: {
        coach: true,
      },
      orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
      take: 8,
      where: {
        traineeId: trainee.id,
      },
    }),
  ])

  const plannedSessionsPerWeek = trainee.programAssignments.reduce(
    (sum, assignment) => sum + assignment.program.workoutsPerWeek,
    0,
  )
  const totalVolumeLast30Days = progressLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const completionRate =
    plannedSessionsPerWeek > 0 ? Math.min(100, Math.round((thisWeekWorkouts / plannedSessionsPerWeek) * 100)) : 0

  return {
    bodyMetrics: bodyMetrics.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord)),
    checkIns: checkIns.map((entry) => serializeCoachCheckIn(entry as CoachCheckInRecord)),
    programs: trainee.programAssignments.map((assignment) => serializeProgram(assignment.program as ProgramRecord)),
    progressSummary: {
      completionRate,
      latestWorkoutAt: trainee.workoutLogs[0]?.startedAt ?? progressLogs[0]?.startedAt ?? undefined,
      plannedSessionsPerWeek,
      totalVolumeLast30Days,
      workoutsLast30Days: progressLogs.length,
      workoutsLast7Days: thisWeekWorkouts,
    },
    recentLogs: trainee.workoutLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    trainee: {
      avatar: trainee.avatar,
      createdAt: trainee.createdAt,
      email: trainee.email,
      fitnessGoals: trainee.fitnessGoals,
      id: trainee.id,
      lastCheckInAt: checkIns[0]?.checkInDate,
      latestWeightKg: bodyMetrics[0]?.weightKg ?? undefined,
      name: trainee.name,
      phone: trainee.phone ?? undefined,
      programCount: trainee._count.programAssignments,
      thisWeekWorkouts,
      totalWorkoutLogs: trainee._count.workoutLogs,
    },
  }
}

async function getCoachDashboard(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const [trainees, pendingRequests] = await Promise.all([
    listCoachTrainees(profile),
    db.coachRequest.findMany({
      include: {
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        coachId: profile.id,
        status: CoachRequestStatus.pending,
      },
    }),
  ])

  return {
    pendingRequests: pendingRequests.map(serializeCoachRequest),
    trainees,
  }
}

async function updateCoachRequestStatus(
  profile: SerializedProfile,
  requestId: string,
  status: CoachRequestStatus,
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (status === CoachRequestStatus.pending) {
    throw new AuthServiceError("Trạng thái cập nhật không hợp lệ.", 400)
  }

  const existingRequest = await db.coachRequest.findFirst({
    include: {
      trainee: true,
    },
    where: {
      coachId: profile.id,
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status !== CoachRequestStatus.pending) {
    throw new AuthServiceError("Coach request này đã được xử lý.", 400)
  }

  const updatedRequest = await db.$transaction(async (transaction) => {
    const request = await transaction.coachRequest.update({
      data: {
        status,
      },
      include: {
        trainee: true,
      },
      where: {
        id: requestId,
      },
    })

    if (status === CoachRequestStatus.approved) {
      await transaction.user.update({
        data: {
          coachId: profile.id,
        },
        where: {
          id: existingRequest.traineeId,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          id: {
            not: requestId,
          },
          status: CoachRequestStatus.pending,
          traineeId: existingRequest.traineeId,
        },
      })
    }

    return request
  })

  return serializeCoachRequest(updatedRequest)
}

export {
  assignCoachProgramToTrainee,
  createBodyMetricForTrainee,
  createBodyMetricForCurrentTrainee,
  createCoachCheckInForTrainee,
  createCoachRequestForTrainee,
  createCoachProgram,
  createMealForUser,
  createPersonalWorkoutForTrainee,
  createWorkoutLogForTrainee,
  deleteCoachProgram,
  deleteMealForUser,
  deletePersonalWorkoutForTrainee,
  getCoachDashboard,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  getWorkoutDetailForTrainee,
  listAvailableCoachesForTrainee,
  listBodyMetricsForCurrentTrainee,
  listCoachPrograms,
  listCoachTrainees,
  listExercises,
  listMealsForUser,
  listWorkoutsForTrainee,
  resetCurrentTraineeData,
  unassignCoachProgramFromTrainee,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateMealForUser,
  updatePersonalWorkoutForTrainee,
}
