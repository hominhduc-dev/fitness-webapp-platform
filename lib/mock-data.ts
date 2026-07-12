import type {
  User,
  Workout,
  Exercise,
  WorkoutLog,
  Meal,
  DailyNutrition,
  CoachRequest,
  WeeklySchedule,
  Program,
} from "./types"

export const mockCredentials = [
  { email: "alex@example.com", password: "123456", userId: "1" },
  { email: "mike@example.com", password: "123456", userId: "2" },
  { email: "sarah@example.com", password: "123456", userId: "3" },
]

export const exercises: Exercise[] = [
  { id: "1", name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { id: "2", name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "3", name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { id: "4", name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { id: "5", name: "Pull-ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { id: "6", name: "Rows", muscleGroup: "Back", equipment: "Barbell" },
  { id: "7", name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { id: "8", name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { id: "9", name: "Bicep Curls", muscleGroup: "Arms", equipment: "Dumbbell" },
  { id: "10", name: "Tricep Pushdown", muscleGroup: "Arms", equipment: "Cable" },
  { id: "11", name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbell" },
  { id: "12", name: "Incline Bench Press", muscleGroup: "Chest", equipment: "Dumbbell" },
]

export const currentUser: User = {
  id: "1",
  name: "Alex Johnson",
  email: "alex@example.com",
  role: "trainee",
  avatar: "/athletic-male-avatar.jpg",
  fitnessGoals: ["Build Muscle", "Increase Strength"],
  createdAt: new Date("2024-01-01"),
}

export const coachUser: User = {
  id: "2",
  name: "Coach Mike",
  email: "mike@example.com",
  role: "coach",
  avatar: "/professional-fitness-coach-avatar.jpg",
  createdAt: new Date("2023-06-01"),
}

export const sampleWorkouts: Workout[] = [
  {
    id: "1",
    name: "Push Day",
    scheduledDay: 1,
    duration: 60,
    exercises: [
      {
        id: "1",
        exercise: exercises[0],
        sets: [
          { id: "1", setNumber: 1, targetReps: 8, weight: 135, completed: false },
          { id: "2", setNumber: 2, targetReps: 8, weight: 135, completed: false },
          { id: "3", setNumber: 3, targetReps: 8, weight: 135, completed: false },
          { id: "4", setNumber: 4, targetReps: 8, weight: 135, completed: false },
        ],
        restTime: 120,
      },
      {
        id: "2",
        exercise: exercises[3],
        sets: [
          { id: "5", setNumber: 1, targetReps: 10, weight: 95, completed: false },
          { id: "6", setNumber: 2, targetReps: 10, weight: 95, completed: false },
          { id: "7", setNumber: 3, targetReps: 10, weight: 95, completed: false },
        ],
        restTime: 90,
      },
      {
        id: "3",
        exercise: exercises[11],
        sets: [
          { id: "8", setNumber: 1, targetReps: 12, weight: 50, completed: false },
          { id: "9", setNumber: 2, targetReps: 12, weight: 50, completed: false },
          { id: "10", setNumber: 3, targetReps: 12, weight: 50, completed: false },
        ],
        restTime: 60,
      },
    ],
  },
  {
    id: "2",
    name: "Pull Day",
    scheduledDay: 2,
    duration: 55,
    exercises: [
      {
        id: "4",
        exercise: exercises[2],
        sets: [
          { id: "11", setNumber: 1, targetReps: 5, weight: 225, completed: false },
          { id: "12", setNumber: 2, targetReps: 5, weight: 225, completed: false },
          { id: "13", setNumber: 3, targetReps: 5, weight: 225, completed: false },
        ],
        restTime: 180,
      },
      {
        id: "5",
        exercise: exercises[4],
        sets: [
          { id: "14", setNumber: 1, targetReps: 8, completed: false },
          { id: "15", setNumber: 2, targetReps: 8, completed: false },
          { id: "16", setNumber: 3, targetReps: 8, completed: false },
        ],
        restTime: 90,
      },
      {
        id: "6",
        exercise: exercises[5],
        sets: [
          { id: "17", setNumber: 1, targetReps: 10, weight: 135, completed: false },
          { id: "18", setNumber: 2, targetReps: 10, weight: 135, completed: false },
          { id: "19", setNumber: 3, targetReps: 10, weight: 135, completed: false },
        ],
        restTime: 90,
      },
    ],
  },
  {
    id: "3",
    name: "Leg Day",
    scheduledDay: 4,
    duration: 65,
    exercises: [
      {
        id: "7",
        exercise: exercises[1],
        sets: [
          { id: "20", setNumber: 1, targetReps: 6, weight: 185, completed: false },
          { id: "21", setNumber: 2, targetReps: 6, weight: 185, completed: false },
          { id: "22", setNumber: 3, targetReps: 6, weight: 185, completed: false },
          { id: "23", setNumber: 4, targetReps: 6, weight: 185, completed: false },
        ],
        restTime: 180,
      },
      {
        id: "8",
        exercise: exercises[6],
        sets: [
          { id: "24", setNumber: 1, targetReps: 12, weight: 270, completed: false },
          { id: "25", setNumber: 2, targetReps: 12, weight: 270, completed: false },
          { id: "26", setNumber: 3, targetReps: 12, weight: 270, completed: false },
        ],
        restTime: 90,
      },
      {
        id: "9",
        exercise: exercises[10],
        sets: [
          { id: "27", setNumber: 1, targetReps: 10, weight: 40, completed: false },
          { id: "28", setNumber: 2, targetReps: 10, weight: 40, completed: false },
          { id: "29", setNumber: 3, targetReps: 10, weight: 40, completed: false },
        ],
        restTime: 60,
      },
    ],
  },
]

export const weeklySchedule: WeeklySchedule = {
  0: null, // Sunday - Rest
  1: sampleWorkouts[0], // Monday - Push
  2: sampleWorkouts[1], // Tuesday - Pull
  3: null, // Wednesday - Rest
  4: sampleWorkouts[2], // Thursday - Legs
  5: sampleWorkouts[0], // Friday - Push
  6: null, // Saturday - Rest
}

export const recentWorkoutLogs: WorkoutLog[] = [
  {
    id: "1",
    workout: sampleWorkouts[0],
    startedAt: new Date("2024-12-16T09:00:00"),
    completedAt: new Date("2024-12-16T10:05:00"),
    exercises: sampleWorkouts[0].exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({ ...set, completed: true, actualReps: set.targetReps })),
    })),
    totalVolume: 12450,
  },
  {
    id: "2",
    workout: sampleWorkouts[1],
    startedAt: new Date("2024-12-17T08:30:00"),
    completedAt: new Date("2024-12-17T09:25:00"),
    exercises: sampleWorkouts[1].exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({ ...set, completed: true, actualReps: set.targetReps })),
    })),
    totalVolume: 9875,
  },
]

export const todaysMeals: Meal[] = [
  {
    id: "1",
    type: "breakfast",
    name: "Oatmeal with Berries",
    calories: 350,
    protein: 12,
    carbs: 58,
    fat: 8,
    time: new Date("2024-12-19T07:30:00"),
  },
  {
    id: "2",
    type: "snack",
    name: "Protein Shake",
    calories: 180,
    protein: 30,
    carbs: 5,
    fat: 3,
    time: new Date("2024-12-19T10:00:00"),
  },
  {
    id: "3",
    type: "lunch",
    name: "Grilled Chicken Salad",
    calories: 520,
    protein: 45,
    carbs: 25,
    fat: 28,
    time: new Date("2024-12-19T12:30:00"),
  },
]

export const dailyNutrition: DailyNutrition = {
  date: new Date(),
  meals: todaysMeals,
  totalCalories: 1050,
  targetCalories: 2500,
}

export const pendingCoachRequests: CoachRequest[] = [
  {
    id: "1",
    traineeId: "3",
    coachId: "2",
    status: "pending",
    createdAt: new Date("2024-12-18"),
  },
]

export const trainees: User[] = [
  {
    id: "3",
    name: "Sarah Chen",
    email: "sarah@example.com",
    role: "trainee",
    avatar: "/athletic-woman-avatar-fitness.jpg",
    fitnessGoals: ["Lose Weight", "Tone Up"],
    coachId: "2",
    createdAt: new Date("2024-06-15"),
  },
  {
    id: "4",
    name: "Marcus Williams",
    email: "marcus@example.com",
    role: "trainee",
    avatar: "/muscular-black-man-avatar.jpg",
    fitnessGoals: ["Build Muscle", "Competition Prep"],
    coachId: "2",
    createdAt: new Date("2024-08-01"),
  },
  {
    id: "5",
    name: "Emma Rodriguez",
    email: "emma@example.com",
    role: "trainee",
    avatar: "/latina-woman-fitness-avatar.jpg",
    fitnessGoals: ["Increase Strength", "Flexibility"],
    coachId: "2",
    createdAt: new Date("2024-09-20"),
  },
]

export const weeklyCaloriesData = [
  { day: "Mon", calories: 2450, target: 2500 },
  { day: "Tue", calories: 2380, target: 2500 },
  { day: "Wed", calories: 2600, target: 2500 },
  { day: "Thu", calories: 2520, target: 2500 },
  { day: "Fri", calories: 2100, target: 2500 },
  { day: "Sat", calories: 2800, target: 2500 },
  { day: "Sun", calories: 2200, target: 2500 },
]

export const muscleGroupDistribution = [
  { name: "Chest", value: 20, fill: "var(--chart-1)" },
  { name: "Back", value: 25, fill: "var(--chart-2)" },
  { name: "Legs", value: 30, fill: "var(--chart-3)" },
  { name: "Shoulders", value: 10, fill: "var(--chart-4)" },
  { name: "Arms", value: 15, fill: "var(--chart-5)" },
]

export const progressionData = [
  { week: "W1", benchPress: 135, squat: 185, deadlift: 225 },
  { week: "W2", benchPress: 140, squat: 190, deadlift: 235 },
  { week: "W3", benchPress: 145, squat: 195, deadlift: 245 },
  { week: "W4", benchPress: 145, squat: 200, deadlift: 250 },
  { week: "W5", benchPress: 150, squat: 205, deadlift: 255 },
  { week: "W6", benchPress: 155, squat: 210, deadlift: 265 },
]

export const coachPrograms: Program[] = [
  {
    id: "1",
    name: "Beginner Strength Builder",
    description: "Perfect for those new to strength training. Focus on compound movements with progressive overload.",
    duration: 8,
    difficulty: "beginner",
    workoutsPerWeek: 3,
    workouts: sampleWorkouts,
    assignedTo: ["3"],
    createdAt: new Date("2024-10-01"),
    createdBy: "2",
  },
  {
    id: "2",
    name: "Hypertrophy Program",
    description: "Build muscle mass with high volume training and optimal rest periods.",
    duration: 12,
    difficulty: "intermediate",
    workoutsPerWeek: 4,
    workouts: sampleWorkouts,
    assignedTo: ["4", "5"],
    createdAt: new Date("2024-11-15"),
    createdBy: "2",
  },
  {
    id: "3",
    name: "Advanced Powerlifting",
    description: "Competition prep program focusing on squat, bench, and deadlift with peaking cycles.",
    duration: 16,
    difficulty: "advanced",
    workoutsPerWeek: 5,
    workouts: sampleWorkouts,
    assignedTo: ["4"],
    createdAt: new Date("2024-12-01"),
    createdBy: "2",
  },
]
