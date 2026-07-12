export type UserRole = "trainee" | "coach"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  fitnessGoals?: string[]
  coachId?: string
  createdAt: Date
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment?: string
}

export interface ExerciseSet {
  id: string
  setNumber: number
  targetReps: number
  actualReps?: number
  weight?: number
  rir?: number // Reps in Reserve
  notes?: string
  completed: boolean
}

export interface WorkoutExercise {
  id: string
  exercise: Exercise
  sets: ExerciseSet[]
  restTime?: number // seconds
  notes?: string
}

export interface Workout {
  id: string
  name: string
  exercises: WorkoutExercise[]
  scheduledDay?: number // 0-6 for days of week
  duration?: number // minutes
  completedAt?: Date
  notes?: string
}

export interface WorkoutLog {
  id: string
  workout: Workout
  startedAt: Date
  completedAt?: Date
  exercises: WorkoutExercise[]
  totalVolume?: number
  notes?: string
}

export interface Meal {
  id: string
  type: "breakfast" | "lunch" | "dinner" | "snack"
  name: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
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
