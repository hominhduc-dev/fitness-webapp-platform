-- Baseline migration for environments that start from an empty database or Prisma shadow database.
-- Existing environments that already contain this schema should mark this migration as applied:
--   npx prisma migrate resolve --applied 20260319_initial_schema_baseline

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('trainee', 'coach', 'admin');

-- CreateEnum
CREATE TYPE "ProgramDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "CoachRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('kg', 'lbs');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('system', 'user', 'imported');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('workout_reminder', 'meal_reminder', 'check_in_reminder', 'program_assigned', 'coach_request', 'general');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "supabaseAuthUserId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "fitnessGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredWeightUnit" "WeightUnit" NOT NULL DEFAULT 'kg',
    "dailyCalorieGoal" INTEGER NOT NULL DEFAULT 2500,
    "heightCm" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "coachId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "servingAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "servingUnit" TEXT NOT NULL DEFAULT 'serving',
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "source" "FoodSource" NOT NULL DEFAULT 'system',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "servings" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "instructions" JSONB,
    "mealType" "MealType",
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeFoodItem" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "difficulty" "ProgramDifficulty" NOT NULL,
    "workoutsPerWeek" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" UUID NOT NULL,
    "programId" UUID,
    "name" TEXT NOT NULL,
    "scheduledDay" INTEGER,
    "duration" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "restTime" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" UUID NOT NULL,
    "workoutExerciseId" UUID NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL,
    "actualReps" INTEGER,
    "weight" DOUBLE PRECISION,
    "rir" INTEGER,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workoutId" UUID,
    "workoutSnapshot" JSONB,
    "exerciseSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "totalVolume" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetricEntry" (
    "id" UUID NOT NULL,
    "traineeId" UUID NOT NULL,
    "coachId" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMetricEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachCheckIn" (
    "id" UUID NOT NULL,
    "traineeId" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adherenceScore" INTEGER,
    "energyScore" INTEGER,
    "recoveryScore" INTEGER,
    "moodScore" INTEGER,
    "summary" TEXT,
    "feedback" TEXT NOT NULL,
    "nextFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "MealType" NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" INTEGER,
    "carbs" INTEGER,
    "fat" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealFoodItem" (
    "id" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "sourceRecipeId" UUID,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "foodNameSnapshot" TEXT,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachRequest" (
    "id" UUID NOT NULL,
    "traineeId" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "status" "CoachRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'in_app',
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "entityLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseAuthUserId_key" ON "User"("supabaseAuthUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_coachId_idx" ON "User"("coachId");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Exercise_createdById_idx" ON "Exercise"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Food_barcode_key" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_createdById_idx" ON "Food"("createdById");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Recipe_createdById_idx" ON "Recipe"("createdById");

-- CreateIndex
CREATE INDEX "Recipe_name_idx" ON "Recipe"("name");

-- CreateIndex
CREATE INDEX "RecipeFoodItem_foodId_idx" ON "RecipeFoodItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeFoodItem_recipeId_order_key" ON "RecipeFoodItem"("recipeId", "order");

-- CreateIndex
CREATE INDEX "Program_createdById_idx" ON "Program"("createdById");

-- CreateIndex
CREATE INDEX "ProgramAssignment_userId_idx" ON "ProgramAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_programId_userId_key" ON "ProgramAssignment"("programId", "userId");

-- CreateIndex
CREATE INDEX "Workout_programId_idx" ON "Workout"("programId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_order_idx" ON "WorkoutExercise"("workoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSet_workoutExerciseId_setNumber_key" ON "ExerciseSet"("workoutExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "WorkoutLog_userId_idx" ON "WorkoutLog"("userId");

-- CreateIndex
CREATE INDEX "WorkoutLog_workoutId_idx" ON "WorkoutLog"("workoutId");

-- CreateIndex
CREATE INDEX "BodyMetricEntry_traineeId_recordedAt_idx" ON "BodyMetricEntry"("traineeId", "recordedAt");

-- CreateIndex
CREATE INDEX "BodyMetricEntry_coachId_idx" ON "BodyMetricEntry"("coachId");

-- CreateIndex
CREATE INDEX "CoachCheckIn_traineeId_checkInDate_idx" ON "CoachCheckIn"("traineeId", "checkInDate");

-- CreateIndex
CREATE INDEX "CoachCheckIn_coachId_createdAt_idx" ON "CoachCheckIn"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "Meal_userId_recordedAt_idx" ON "Meal"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "MealFoodItem_foodId_idx" ON "MealFoodItem"("foodId");

-- CreateIndex
CREATE INDEX "MealFoodItem_mealId_idx" ON "MealFoodItem"("mealId");

-- CreateIndex
CREATE INDEX "MealFoodItem_sourceRecipeId_idx" ON "MealFoodItem"("sourceRecipeId");

-- CreateIndex
CREATE INDEX "CoachRequest_coachId_idx" ON "CoachRequest"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachRequest_traineeId_coachId_key" ON "CoachRequest"("traineeId", "coachId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_scheduledFor_idx" ON "Notification"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx" ON "Notification"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_createdAt_idx" ON "AdminAuditLog"("entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFoodItem" ADD CONSTRAINT "RecipeFoodItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFoodItem" ADD CONSTRAINT "RecipeFoodItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMetricEntry" ADD CONSTRAINT "BodyMetricEntry_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMetricEntry" ADD CONSTRAINT "BodyMetricEntry_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCheckIn" ADD CONSTRAINT "CoachCheckIn_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCheckIn" ADD CONSTRAINT "CoachCheckIn_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealFoodItem" ADD CONSTRAINT "MealFoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealFoodItem" ADD CONSTRAINT "MealFoodItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealFoodItem" ADD CONSTRAINT "MealFoodItem_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachRequest" ADD CONSTRAINT "CoachRequest_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachRequest" ADD CONSTRAINT "CoachRequest_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


