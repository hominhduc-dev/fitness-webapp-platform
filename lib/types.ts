export type UserRole = "trainee" | "coach" | "admin"

export interface User {
  id: string
  name: string
  email: string
  username?: string
  phone?: string
  role: UserRole
  avatar?: string
  fitnessGoals?: string[]
  preferredWeightUnit?: "kg" | "lbs"
  dailyCalorieGoal?: number
  heightCm?: number
  targetWeightKg?: number
  coachId?: string
  createdAt: Date
}

export interface ExerciseBase {
  id: string
  name: string
  muscleGroup: string
}

export type ExerciseSource = "system" | "coach"

export interface ExerciseVariation {
  id: string
  name: string
  equipment?: string
  isDefault: boolean
  metadata?: Record<string, unknown>
  sortOrder: number
  canManage?: boolean
  createdById?: string
  source?: ExerciseSource
}

export interface ExerciseVariationOption {
  id: string
  exerciseId: string
  exerciseName: string
  variationName: string
  name: string
  muscleGroup: string
  equipment?: string
  isDefault: boolean
  metadata?: Record<string, unknown>
  sortOrder: number
  canManage?: boolean
  createdById?: string
  source?: ExerciseSource
}

export interface ExerciseLibraryExercise extends ExerciseBase {
  canManage?: boolean
  createdById?: string
  createdByName?: string
  source?: ExerciseSource
  variations: ExerciseVariation[]
}

export type PreviousExerciseSetPerformanceSource = "most_recent" | "same_weekday_last_week"

export interface PreviousExerciseSetPerformance {
  completedAt: Date
  reps?: number
  source: PreviousExerciseSetPerformanceSource
  weight?: number
}

export interface ExerciseSet {
  id: string
  setNumber: number
  targetRepsMin?: number
  targetReps: number
  actualReps?: number
  weight?: number
  rir?: number // Reps in Reserve
  notes?: string
  previousPerformance?: PreviousExerciseSetPerformance
  completed: boolean
}

export interface WorkoutExercise {
  id: string
  exercise: ExerciseBase
  variation: ExerciseVariation
  sets: ExerciseSet[]
  restTime?: number // seconds
  notes?: string
}

export interface Workout {
  id: string
  isPersonal?: boolean
  name: string
  exercises: WorkoutExercise[]
  scheduledDay?: number // 0-6 for days of week
  scheduledDate?: Date
  duration?: number // minutes
  completedAt?: Date
  notes?: string
}

export interface WorkoutLogComment {
  id: string
  authorId: string
  authorName: string
  authorAvatar?: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkoutLog {
  id: string
  workout: Workout
  startedAt: Date
  completedAt?: Date
  exercises: WorkoutExercise[]
  comments: WorkoutLogComment[]
  totalVolume?: number
  notes?: string
}

export interface Meal {
  id: string
  type: "breakfast" | "lunch" | "dinner" | "snack"
  name: string
  calories: number
  foodId?: string
  fdcId?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  weightGrams?: number
  time: Date
}

export interface DailyNutrition {
  date: Date
  meals: Meal[]
  totalCalories: number
  targetCalories: number
}

export interface CoachRequest {
  id: string
  traineeId: string
  coachId: string
  status: "pending" | "approved" | "rejected"
  createdAt: Date
}

export interface WeeklySchedule {
  [key: number]: Workout | null // 0-6 for days of week
}

export interface Program {
  id: string
  name: string
  description?: string
  duration: number // weeks
  difficulty: "beginner" | "intermediate" | "advanced"
  workoutsPerWeek: number
  workouts: Workout[]
  assignedTo?: string[] // trainee IDs
  createdAt: Date
  createdBy: string // coach ID
}

export type Exercise = ExerciseVariationOption
