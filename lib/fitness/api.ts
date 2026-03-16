import { ApiError } from "@/lib/auth/api"
import { getApiBaseUrl } from "@/lib/supabase/config"
import type { DailyNutrition, Exercise, ExerciseSet, Meal, Program, Workout, WorkoutLog } from "@/lib/types"

import type {
  CoachDashboardData,
  CoachProgram,
  CoachTrainee,
  CoachTraineeDetail,
  CreateCoachProgramInput,
  DiscoverableCoach,
  MealCollection,
  WeeklyCaloriesPoint,
  WorkoutCollection,
  WorkoutLogInput,
} from "./types"

type SerializedExercise = Exercise

type SerializedExerciseSet = {
  actualReps?: number
  completed: boolean
  id: string
  notes?: string
  rir?: number
  setNumber: number
  targetReps: number
  weight?: number
}

type SerializedWorkout = {
  duration?: number
  exercises: Array<{
    exercise: SerializedExercise
    id: string
    notes?: string
    restTime?: number
    sets: SerializedExerciseSet[]
  }>
  id: string
  name: string
  notes?: string
  scheduledDay?: number
}

type SerializedWorkoutLog = {
  completedAt?: string | null
  exercises: SerializedWorkout["exercises"]
  id: string
  notes?: string
  startedAt: string
  totalVolume?: number
  workout: SerializedWorkout
}

type SerializedMeal = {
  calories: number
  carbs?: number
  fat?: number
  id: string
  name: string
  protein?: number
  time: string
  type: Meal["type"]
}

type SerializedAssignedTrainee = {
  avatar?: string | null
  email: string
  fitnessGoals: string[]
  id: string
  name: string
}

type SerializedCoachProgram = Omit<Program, "createdAt" | "workouts"> & {
  assignedTrainees: SerializedAssignedTrainee[]
  createdAt: string
  workouts: SerializedWorkout[]
}

type SerializedCoachTrainee = {
  avatar?: string | null
  createdAt: string
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  programCount: number
  thisWeekWorkouts: number
  totalWorkoutLogs: number
}

type SerializedCoachRequest = {
  coachId: string
  createdAt: string
  id: string
  status: "pending" | "approved" | "rejected"
  trainee: SerializedAssignedTrainee
  traineeId: string
}

type SerializedDiscoverableCoach = {
  activeTrainees: number
  avatar?: string | null
  createdAt: string
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  requestId?: string
  requestStatus: DiscoverableCoach["requestStatus"]
}

type SerializedCoachRequestCreate = {
  request: {
    coachId: string
    createdAt: string
    id: string
    requestStatus: "pending" | "approved" | "rejected"
    traineeId: string
  }
}

type SerializedDailyNutrition = Omit<DailyNutrition, "date" | "meals"> & {
  date: string
  meals: SerializedMeal[]
}

async function parseJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { error?: string; message?: string } | null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && ("error" in payload || "message" in payload)
        ? payload.error ?? payload.message ?? "Request failed"
        : "Request failed"

    throw new ApiError(message, response.status)
  }

  return payload as T
}

async function request<T>(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  return parseJson<T>(response)
}

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined
}

function mapExerciseSet(set: SerializedExerciseSet): ExerciseSet {
  return {
    actualReps: set.actualReps,
    completed: set.completed,
    id: set.id,
    notes: set.notes,
    rir: set.rir,
    setNumber: set.setNumber,
    targetReps: set.targetReps,
    weight: set.weight,
  }
}

function mapWorkout(workout: SerializedWorkout): Workout {
  return {
    duration: workout.duration,
    exercises: workout.exercises.map((exercise) => ({
      exercise: exercise.exercise,
      id: exercise.id,
      notes: exercise.notes,
      restTime: exercise.restTime,
      sets: exercise.sets.map(mapExerciseSet),
    })),
    id: workout.id,
    name: workout.name,
    notes: workout.notes,
    scheduledDay: workout.scheduledDay,
  }
}

function mapWorkoutLog(log: SerializedWorkoutLog): WorkoutLog {
  return {
    completedAt: toDate(log.completedAt),
    exercises: log.exercises.map((exercise) => ({
      exercise: exercise.exercise,
      id: exercise.id,
      notes: exercise.notes,
      restTime: exercise.restTime,
      sets: exercise.sets.map(mapExerciseSet),
    })),
    id: log.id,
    notes: log.notes,
    startedAt: new Date(log.startedAt),
    totalVolume: log.totalVolume,
    workout: mapWorkout(log.workout),
  }
}

function mapMeal(meal: SerializedMeal): Meal {
  return {
    calories: meal.calories,
    carbs: meal.carbs,
    fat: meal.fat,
    id: meal.id,
    name: meal.name,
    protein: meal.protein,
    time: new Date(meal.time),
    type: meal.type,
  }
}

function mapCoachProgram(program: SerializedCoachProgram): CoachProgram {
  return {
    assignedTo: program.assignedTo,
    assignedTrainees: program.assignedTrainees,
    createdAt: new Date(program.createdAt),
    createdBy: program.createdBy,
    description: program.description,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts.map(mapWorkout),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function mapCoachTrainee(trainee: SerializedCoachTrainee): CoachTrainee {
  return {
    avatar: trainee.avatar,
    createdAt: new Date(trainee.createdAt),
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    name: trainee.name,
    programCount: trainee.programCount,
    thisWeekWorkouts: trainee.thisWeekWorkouts,
    totalWorkoutLogs: trainee.totalWorkoutLogs,
  }
}

function mapDiscoverableCoach(coach: SerializedDiscoverableCoach): DiscoverableCoach {
  return {
    activeTrainees: coach.activeTrainees,
    avatar: coach.avatar,
    createdAt: new Date(coach.createdAt),
    email: coach.email,
    fitnessGoals: coach.fitnessGoals,
    id: coach.id,
    name: coach.name,
    requestId: coach.requestId,
    requestStatus: coach.requestStatus,
  }
}

async function fetchMeals(accessToken: string, date?: string): Promise<MealCollection> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  const response = await request<{
    dailyNutrition: SerializedDailyNutrition
    meals: SerializedMeal[]
    weeklyCalories: WeeklyCaloriesPoint[]
  }>(`/api/meals${query}`, accessToken)
  const meals = response.meals.map(mapMeal)

  return {
    dailyNutrition: {
      date: new Date(response.dailyNutrition.date),
      meals,
      targetCalories: response.dailyNutrition.targetCalories,
      totalCalories: response.dailyNutrition.totalCalories,
    },
    meals,
    weeklyCalories: response.weeklyCalories,
  }
}

async function createMeal(
  accessToken: string,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string
    type: Meal["type"]
  },
) {
  const response = await request<{ meal: SerializedMeal }>("/api/meals", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapMeal(response.meal)
}

async function updateMeal(
  accessToken: string,
  mealId: string,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string
    type: Meal["type"]
  },
) {
  const response = await request<{ meal: SerializedMeal }>(`/api/meals/${mealId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH",
  })

  return mapMeal(response.meal)
}

async function deleteMeal(accessToken: string, mealId: string) {
  await request<{ deleted: boolean; id: string }>(`/api/meals/${mealId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchWorkouts(accessToken: string): Promise<WorkoutCollection> {
  const response = await request<{
    recentLogs: SerializedWorkoutLog[]
    schedule: Record<number, SerializedWorkout | null>
    todayWorkout: SerializedWorkout | null
    workouts: SerializedWorkout[]
  }>("/api/workouts", accessToken)

  return {
    recentLogs: response.recentLogs.map(mapWorkoutLog),
    schedule: Object.fromEntries(
      Object.entries(response.schedule).map(([day, workout]) => [Number(day), workout ? mapWorkout(workout) : null]),
    ) as Record<number, Workout | null>,
    todayWorkout: response.todayWorkout ? mapWorkout(response.todayWorkout) : null,
    workouts: response.workouts.map(mapWorkout),
  }
}

async function fetchWorkoutDetail(accessToken: string, workoutId: string) {
  const response = await request<{ workout: SerializedWorkout }>(`/api/workouts/${workoutId}`, accessToken)
  return mapWorkout(response.workout)
}

async function createWorkoutLog(accessToken: string, workoutId: string, input: WorkoutLogInput) {
  const response = await request<{ log: SerializedWorkoutLog }>(`/api/workouts/${workoutId}/logs`, accessToken, {
    body: JSON.stringify({
      ...input,
      exercises: input.exercises,
    }),
    method: "POST",
  })

  return mapWorkoutLog(response.log)
}

async function fetchExercises(accessToken: string): Promise<Exercise[]> {
  const response = await request<{ exercises: Exercise[] }>("/api/exercises", accessToken)
  return response.exercises
}

async function fetchCoachPrograms(accessToken: string): Promise<CoachProgram[]> {
  const response = await request<{ programs: SerializedCoachProgram[] }>("/api/coach/programs", accessToken)
  return response.programs.map(mapCoachProgram)
}

async function createCoachProgram(accessToken: string, input: CreateCoachProgramInput) {
  const response = await request<{ program: SerializedCoachProgram }>("/api/coach/programs", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapCoachProgram(response.program)
}

async function fetchCoachProgram(accessToken: string, programId: string): Promise<CoachProgram> {
  const response = await request<{ program: SerializedCoachProgram }>(`/api/coach/programs/${programId}`, accessToken)
  return mapCoachProgram(response.program)
}

async function updateCoachProgram(accessToken: string, programId: string, input: CreateCoachProgramInput) {
  const response = await request<{ program: SerializedCoachProgram }>(`/api/coach/programs/${programId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH",
  })

  return mapCoachProgram(response.program)
}

async function deleteCoachProgram(accessToken: string, programId: string) {
  await request<{ deleted: boolean; id: string }>(`/api/coach/programs/${programId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchCoachTrainees(accessToken: string): Promise<CoachTrainee[]> {
  const response = await request<{ trainees: SerializedCoachTrainee[] }>("/api/coach/trainees", accessToken)
  return response.trainees.map(mapCoachTrainee)
}

async function fetchCoachTraineeDetail(accessToken: string, traineeId: string): Promise<CoachTraineeDetail> {
  const response = await request<{
    programs: SerializedCoachProgram[]
    recentLogs: SerializedWorkoutLog[]
    trainee: SerializedCoachTrainee
  }>(`/api/coach/trainees/${traineeId}`, accessToken)

  return {
    programs: response.programs.map(mapCoachProgram),
    recentLogs: response.recentLogs.map(mapWorkoutLog),
    trainee: mapCoachTrainee(response.trainee),
  }
}

async function fetchCoachDashboard(accessToken: string): Promise<CoachDashboardData> {
  const response = await request<{
    pendingRequests: SerializedCoachRequest[]
    trainees: SerializedCoachTrainee[]
  }>("/api/coach/dashboard", accessToken)

  return {
    pendingRequests: response.pendingRequests.map((requestItem) => ({
      coachId: requestItem.coachId,
      createdAt: new Date(requestItem.createdAt),
      id: requestItem.id,
      status: requestItem.status,
      trainee: requestItem.trainee,
      traineeId: requestItem.traineeId,
    })),
    trainees: response.trainees.map(mapCoachTrainee),
  }
}

async function fetchDiscoverableCoaches(accessToken: string): Promise<DiscoverableCoach[]> {
  const response = await request<{ coaches: SerializedDiscoverableCoach[] }>("/api/coach/discover", accessToken)
  return response.coaches.map(mapDiscoverableCoach)
}

async function createCoachRequest(accessToken: string, coachId: string) {
  const response = await request<SerializedCoachRequestCreate>("/api/coach/requests", accessToken, {
    body: JSON.stringify({
      coachId,
    }),
    method: "POST",
  })

  return {
    coachId: response.request.coachId,
    createdAt: new Date(response.request.createdAt),
    id: response.request.id,
    status: response.request.requestStatus,
    traineeId: response.request.traineeId,
  }
}

async function updateCoachRequestStatus(
  accessToken: string,
  requestId: string,
  status: "approved" | "rejected",
) {
  const response = await request<{ request: SerializedCoachRequest }>(`/api/coach/requests/${requestId}`, accessToken, {
    body: JSON.stringify({
      status,
    }),
    method: "PATCH",
  })

  return {
    coachId: response.request.coachId,
    createdAt: new Date(response.request.createdAt),
    id: response.request.id,
    status: response.request.status,
    trainee: response.request.trainee,
    traineeId: response.request.traineeId,
  }
}

export {
  createCoachRequest,
  createCoachProgram,
  createMeal,
  createWorkoutLog,
  deleteMeal,
  deleteCoachProgram,
  fetchDiscoverableCoaches,
  fetchCoachDashboard,
  fetchCoachProgram,
  fetchCoachPrograms,
  fetchCoachTraineeDetail,
  fetchCoachTrainees,
  fetchExercises,
  fetchMeals,
  fetchWorkoutDetail,
  fetchWorkouts,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateMeal,
}
