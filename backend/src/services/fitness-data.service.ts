import {
  CoachRequestStatus,
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

function serializeWorkout(workout: WorkoutRecord) {
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
      .map(serializeWorkout),
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
      targetCalories: DEFAULT_CALORIE_TARGET,
      totalCalories,
    },
    meals: serializedMeals,
    weeklyCalories: buildWeeklyCaloriesChart(weeklyMeals),
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

  assignments.flatMap((assignment) => assignment.program.workouts as WorkoutRecord[]).forEach((workout) => {
    workoutMap.set(workout.id, workout)
  })

  const serializedWorkouts = Array.from(workoutMap.values())
    .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
    .map(serializeWorkout)

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

  return serializeWorkout(workout as WorkoutRecord)
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

async function createPersonalWorkoutForTrainee(
  profile: SerializedProfile,
  input: {
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
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

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
      name: workoutName,
      workouts: {
        create: {
          duration: input.duration ? Math.max(1, Math.round(input.duration)) : undefined,
          exercises: {
            create: input.exercises.map((exercise, exerciseIndex) => ({
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
          name: workoutName,
          notes: input.notes?.trim() || undefined,
          scheduledDay: typeof input.scheduledDay === "number" ? input.scheduledDay : undefined,
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

  return serializeWorkout(workout as WorkoutRecord)
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

async function listCoachTrainees(profile: SerializedProfile) {
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

  const traineeIds = trainees.map((trainee) => trainee.id)
  const recentWindow = toRecentWindow(7)
  const recentLogs = traineeIds.length
    ? await db.workoutLog.findMany({
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
      })
    : []

  const thisWeekByUser = recentLogs.reduce<Map<string, number>>((accumulator, log) => {
    accumulator.set(log.userId, (accumulator.get(log.userId) ?? 0) + 1)
    return accumulator
  }, new Map())

  return trainees.map((trainee) => ({
    avatar: trainee.avatar,
    createdAt: trainee.createdAt,
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    name: trainee.name,
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
  const thisWeekWorkouts = await db.workoutLog.count({
    where: {
      startedAt: {
        gte: recentWindow.start,
        lte: recentWindow.end,
      },
      userId: trainee.id,
    },
  })

  return {
    programs: trainee.programAssignments.map((assignment) => serializeProgram(assignment.program as ProgramRecord)),
    recentLogs: trainee.workoutLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    trainee: {
      avatar: trainee.avatar,
      createdAt: trainee.createdAt,
      email: trainee.email,
      fitnessGoals: trainee.fitnessGoals,
      id: trainee.id,
      name: trainee.name,
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
  createCoachRequestForTrainee,
  createCoachProgram,
  createMealForUser,
  createPersonalWorkoutForTrainee,
  createWorkoutLogForTrainee,
  deleteMealForUser,
  deleteCoachProgram,
  getCoachDashboard,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  getWorkoutDetailForTrainee,
  listAvailableCoachesForTrainee,
  listCoachPrograms,
  listCoachTrainees,
  listExercises,
  listMealsForUser,
  listWorkoutsForTrainee,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateMealForUser,
}
