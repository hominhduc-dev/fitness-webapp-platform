# Từ điển dữ liệu

Nguồn: schema.snapshot.prisma, revision 1134c533f7f92cb7a667f051cf62b859d985ab9c. 22 bảng, 249 cột. Không chứa bản ghi người dùng.

## User

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| supabaseAuthUserId | String / Uuid | UK | Có | — |
| name | String |  | Không | — |
| email | String | UK | Không | — |
| username | String | UK | Có | — |
| phone | String | UK | Có | — |
| role | UserRole |  | Không | — |
| isActive | Boolean |  | Không | true |
| avatar | String |  | Có | — |
| fitnessGoals | String[] |  | Không | [] |
| preferredWeightUnit | WeightUnit |  | Không | "kg" |
| dailyCalorieGoal | Int |  | Không | 2500 |
| dailyProteinGoal | Int |  | Không | 140 |
| dailyCarbsGoal | Int |  | Không | 280 |
| dailyFatGoal | Int |  | Không | 70 |
| heightCm | Float |  | Có | — |
| targetWeightKg | Float |  | Có | — |
| goalStartWeightKg | Float |  | Có | — |
| birthDate | DateTime / Date |  | Có | — |
| sex | UserSex |  | Có | — |
| activityLevel | ActivityLevel |  | Có | — |
| coachId | String / Uuid | FK | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([coachId])`
- `@@index([username])`
- `@@index([phone])`

- `coachId → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## Exercise

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| name | String |  | Không | — |
| muscleGroup | String |  | Không | — |
| createdById | String / Uuid | FK | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([createdById])`

- `createdById → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## Variation

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| exerciseId | String / Uuid | FK | Không | — |
| name | String |  | Không | — |
| equipment | String |  | Có | — |
| isDefault | Boolean |  | Không | false |
| sortOrder | Int |  | Không | 0 |
| metadata | Json |  | Có | — |
| activityType | ExerciseActivityType |  | Có | — |
| muscleProfileStatus | MuscleProfileStatus |  | Không | "pending" |
| muscleProfileSource | MuscleProfileSource |  | Có | — |
| muscleProfileConfidence | Float |  | Có | — |
| muscleProfileRationale | String |  | Có | — |
| muscleProfileReviewedAt | DateTime |  | Có | — |
| muscleProfileReviewedById | String / Uuid | FK | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@unique([exerciseId, name])`
- `@@index([equipment])`
- `@@index([exerciseId, sortOrder])`
- `@@index([activityType, muscleProfileStatus])`
- `@@index([muscleProfileReviewedById])`

- `exerciseId → Exercise.id`: 1 cha / 0..N con; onDelete Cascade.
- `muscleProfileReviewedById → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## MuscleRegion

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| slug | String | PK | Không | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |




## VariationMuscleTarget

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| variationId | String / Uuid | PK, FK | Không | — |
| muscleSlug | String | PK, FK | Không | — |
| role | MuscleTargetRole |  | Không | — |
| position | Int |  | Không | 0 |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |

- `@@id([variationId, muscleSlug])`
- `@@index([muscleSlug, role])`
- `@@index([variationId, role, position])`

- `variationId → Variation.id`: 1 cha / 0..N con; onDelete Cascade.
- `muscleSlug → MuscleRegion.slug`: 1 cha / 0..N con; onDelete Restrict.

## ExerciseImportRequest

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| submittedById | String / Uuid | FK | Không | — |
| reviewedById | String / Uuid | FK | Có | — |
| status | ExerciseImportRequestStatus |  | Không | "pending" |
| fileName | String |  | Có | — |
| rowCount | Int |  | Không | — |
| rows | Json |  | Không | — |
| reviewNote | String |  | Có | — |
| result | Json |  | Có | — |
| reviewedAt | DateTime |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([status, createdAt])`
- `@@index([submittedById])`
- `@@index([reviewedById])`

- `submittedById → User.id`: 1 cha / 0..N con; onDelete Cascade.
- `reviewedById → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## Food

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| slug | String | UK | Không | — |
| name | String |  | Không | — |
| category | FoodCategory |  | Không | — |
| brand | String |  | Có | — |
| barcode | String | UK | Có | — |
| servingAmount | Float |  | Không | 1 |
| servingUnit | String |  | Không | "serving" |
| servingLabel | String |  | Không | — |
| calories | Float |  | Không | — |
| protein | Float |  | Có | — |
| carbs | Float |  | Có | — |
| fat | Float |  | Có | — |
| fiber | Float |  | Có | — |
| sugar | Float |  | Có | — |
| sodium | Float |  | Có | — |
| source | FoodSource |  | Không | "system" |
| isVerified | Boolean |  | Không | false |
| createdById | String / Uuid | FK | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([createdById])`
- `@@index([category])`
- `@@index([name])`

- `createdById → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## Program

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| name | String |  | Không | — |
| description | String |  | Có | — |
| duration | Int |  | Không | — |
| difficulty | ProgramDifficulty |  | Không | — |
| workoutsPerWeek | Int |  | Không | — |
| isAIGenerated | Boolean |  | Không | false |
| createdById | String / Uuid | FK | Không | — |
| archivedAt | DateTime |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([createdById])`
- `@@index([createdById, archivedAt])`

- `createdById → User.id`: 1 cha / 0..N con; onDelete Cascade.

## ProgramAssignment

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| programId | String / Uuid | FK | Không | — |
| userId | String / Uuid | FK | Không | — |
| assignedAt | DateTime |  | Không | {"name":"now","args":[]} |

- `@@unique([programId, userId])`
- `@@index([userId])`

- `programId → Program.id`: 1 cha / 0..N con; onDelete Cascade.
- `userId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## Workout

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| programId | String / Uuid | FK | Có | — |
| name | String |  | Không | — |
| kind | WorkoutKind |  | Có | — |
| weekIndex | Int |  | Có | — |
| scheduledDay | Int |  | Có | — |
| scheduledDate | DateTime / Date |  | Có | — |
| duration | Int |  | Có | — |
| notes | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([programId])`
- `@@index([programId, weekIndex])`
- `@@index([scheduledDate])`

- `programId → Program.id`: 0..1 cha / 0..N con; onDelete Cascade.

## WorkoutExercise

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| workoutId | String / Uuid | FK | Không | — |
| variationId | String / Uuid | FK | Không | — |
| order | Int |  | Không | — |
| restTime | Int |  | Có | — |
| notes | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([variationId])`
- `@@index([workoutId, order])`

- `workoutId → Workout.id`: 1 cha / 0..N con; onDelete Cascade.
- `variationId → Variation.id`: 1 cha / 0..N con; onDelete Restrict.

## ExerciseSet

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| workoutExerciseId | String / Uuid | FK | Không | — |
| setNumber | Int |  | Không | — |
| targetRepsMin | Int |  | Có | — |
| targetReps | Int |  | Không | — |
| actualReps | Int |  | Có | — |
| weight | Float |  | Có | — |
| rir | Int |  | Có | — |
| notes | String |  | Có | — |
| completed | Boolean |  | Không | false |

- `@@unique([workoutExerciseId, setNumber])`

- `workoutExerciseId → WorkoutExercise.id`: 1 cha / 0..N con; onDelete Cascade.

## WorkoutLog

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| userId | String / Uuid | FK | Không | — |
| workoutId | String / Uuid | FK | Có | — |
| programId | String / Uuid |  | Có | — |
| workoutSnapshot | Json |  | Có | — |
| exerciseSnapshot | Json |  | Có | — |
| plannedDate | DateTime / Date |  | Có | — |
| startedAt | DateTime |  | Không | — |
| completedAt | DateTime |  | Có | — |
| totalVolume | Float |  | Có | — |
| notes | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([userId, startedAt])`
- `@@index([userId, plannedDate])`
- `@@index([workoutId])`
- `@@index([programId])`

- `userId → User.id`: 1 cha / 0..N con; onDelete Cascade.
- `workoutId → Workout.id`: 0..1 cha / 0..N con; onDelete SetNull.

## WorkoutLogComment

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| workoutLogId | String / Uuid | FK | Không | — |
| authorId | String / Uuid | FK | Không | — |
| content | String |  | Không | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([workoutLogId, createdAt])`
- `@@index([authorId, createdAt])`

- `workoutLogId → WorkoutLog.id`: 1 cha / 0..N con; onDelete Cascade.
- `authorId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## BodyMetricEntry

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| traineeId | String / Uuid | FK | Không | — |
| coachId | String / Uuid | FK | Có | — |
| recordedAt | DateTime |  | Không | {"name":"now","args":[]} |
| weightKg | Float |  | Có | — |
| bodyFatPct | Float |  | Có | — |
| chestCm | Float |  | Có | — |
| waistCm | Float |  | Có | — |
| hipsCm | Float |  | Có | — |
| armCm | Float |  | Có | — |
| thighCm | Float |  | Có | — |
| note | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([traineeId, recordedAt])`
- `@@index([coachId])`

- `traineeId → User.id`: 1 cha / 0..N con; onDelete Cascade.
- `coachId → User.id`: 0..1 cha / 0..N con; onDelete SetNull.

## CoachCheckIn

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| traineeId | String / Uuid | FK | Không | — |
| coachId | String / Uuid | FK | Không | — |
| checkInDate | DateTime |  | Không | {"name":"now","args":[]} |
| adherenceScore | Int |  | Có | — |
| energyScore | Int |  | Có | — |
| recoveryScore | Int |  | Có | — |
| moodScore | Int |  | Có | — |
| summary | String |  | Có | — |
| feedback | String |  | Không | — |
| nextFocus | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([traineeId, checkInDate])`
- `@@index([coachId, createdAt])`

- `traineeId → User.id`: 1 cha / 0..N con; onDelete Cascade.
- `coachId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## Meal

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| userId | String / Uuid | FK | Không | — |
| type | MealType |  | Không | — |
| name | String |  | Không | — |
| loggedDate | DateTime / Date |  | Không | — |
| calories | Float |  | Không | — |
| protein | Float |  | Có | — |
| carbs | Float |  | Có | — |
| fat | Float |  | Có | — |
| fiber | Float |  | Có | — |
| sugar | Float |  | Có | — |
| sodium | Float |  | Có | — |
| recordedAt | DateTime |  | Không | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@unique([userId, loggedDate, type])`
- `@@index([userId, loggedDate])`
- `@@index([userId, recordedAt])`

- `userId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## MealFoodItem

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| mealId | String / Uuid | FK | Không | — |
| foodId | String / Uuid | FK | Không | — |
| quantity | Float |  | Không | 1 |
| amountValue | Float |  | Không | 1 |
| amountUnit | String |  | Không | "serving" |
| amountLabel | String |  | Có | — |
| weightGrams | Float |  | Có | — |
| notes | String |  | Có | — |
| foodNameSnapshot | String |  | Có | — |
| calories | Float |  | Không | 0 |
| protein | Float |  | Có | — |
| carbs | Float |  | Có | — |
| fat | Float |  | Có | — |
| fiber | Float |  | Có | — |
| sugar | Float |  | Có | — |
| sodium | Float |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([foodId])`
- `@@index([mealId])`

- `mealId → Meal.id`: 1 cha / 0..N con; onDelete Cascade.
- `foodId → Food.id`: 1 cha / 0..N con; onDelete Restrict.

## CoachRequest

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| traineeId | String / Uuid | FK | Không | — |
| coachId | String / Uuid | FK | Không | — |
| status | CoachRequestStatus |  | Không | "pending" |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@unique([traineeId, coachId])`
- `@@index([coachId, status])`

- `traineeId → User.id`: 1 cha / 0..N con; onDelete Cascade.
- `coachId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## Notification

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| userId | String / Uuid | FK | Không | — |
| type | NotificationType |  | Không | — |
| channel | NotificationChannel |  | Không | "in_app" |
| status | NotificationStatus |  | Không | "pending" |
| title | String |  | Không | — |
| message | String |  | Không | — |
| scheduledFor | DateTime |  | Không | {"name":"now","args":[]} |
| sentAt | DateTime |  | Có | — |
| readAt | DateTime |  | Có | — |
| relatedEntityType | String |  | Có | — |
| relatedEntityId | String |  | Có | — |
| metadata | Json |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |
| updatedAt | DateTime |  | Không | @updatedAt |

- `@@index([userId, status, scheduledFor])`
- `@@index([relatedEntityType, relatedEntityId])`

- `userId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## AdminAuditLog

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| adminId | String / Uuid | FK | Không | — |
| action | String |  | Không | — |
| entityType | String |  | Không | — |
| entityId | String / Uuid |  | Có | — |
| entityLabel | String |  | Có | — |
| metadata | Json |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |

- `@@index([adminId, createdAt])`
- `@@index([entityType, createdAt])`

- `adminId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## AIGeneration

| Cột | Kiểu | Khóa | Nullable | Mặc định |
|---|---|---|---|---|
| id | String / Uuid | PK | Không | {"name":"uuid","args":[4]} |
| userId | String / Uuid | FK | Không | — |
| type | AIGenerationType |  | Không | — |
| status | AIGenerationStatus |  | Không | "pending" |
| input | Json |  | Không | — |
| output | Json |  | Có | — |
| programId | String / Uuid |  | Có | — |
| tokenUsage | Int |  | Có | — |
| errorMsg | String |  | Có | — |
| createdAt | DateTime |  | Không | {"name":"now","args":[]} |

- `@@index([userId, type, createdAt])`

- `userId → User.id`: 1 cha / 0..N con; onDelete Cascade.

## Enum

- **UserRole**: trainee, coach, admin
- **ProgramDifficulty**: beginner, intermediate, advanced
- **MealType**: breakfast, lunch, dinner, snack
- **WorkoutKind**: push, pull, legs, full_body, cardio, other
- **CoachRequestStatus**: pending, approved, rejected
- **ExerciseImportRequestStatus**: pending, approved, rejected
- **ExerciseActivityType**: strength, cardio, mobility, sport, other
- **MuscleTargetRole**: primary, secondary
- **MuscleProfileStatus**: pending, approved
- **MuscleProfileSource**: ai, manual
- **WeightUnit**: kg, lbs
- **FoodSource**: system, user
- **FoodCategory**: staple, protein, veg, fruit, dish, drink, other
- **AIGenerationType**: workout_program, meal_plan
- **AIGenerationStatus**: pending, completed, failed, accepted
- **NotificationType**: workout_reminder, meal_reminder, check_in_reminder, program_assigned, coach_request, workout_logged, general
- **NotificationChannel**: in_app, email, push
- **NotificationStatus**: pending, sent, failed, cancelled
- **UserSex**: male, female
- **ActivityLevel**: sedentary, light, moderate, active, very_active