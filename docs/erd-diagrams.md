# ERD Diagrams - YeahBuddy Fitness

Tài liệu này mô tả sơ đồ thực thể - mối quan hệ (ERD) của cơ sở dữ liệu YeahBuddy Fitness bằng Mermaid `erDiagram`.

Nguồn đối chiếu: `backend/prisma/schema.prisma`.

Quy ước:

- `PK`: Primary Key.
- `FK`: Foreign Key.
- `UK`: Unique Key.
- Field có hậu tố `_nullable` là cột nullable trong Prisma schema.
- Field dạng `StringArray` tương ứng `String[]`.
- Field enum giữ nguyên tên enum trong Prisma, ví dụ `UserRole`, `MealType`, `WorkoutKind`.
- `WorkoutLog.programId` và `AIGeneration.programId` hiện là logical reference theo schema, không khai báo Prisma `@relation`, nên không đánh dấu `FK`.

Composite unique constraints không thể hiện trực tiếp trong Mermaid ERD:

- `Variation`: unique `(exerciseId, name)`.
- `ProgramAssignment`: unique `(programId, userId)`.
- `ExerciseSet`: unique `(workoutExerciseId, setNumber)`.
- `Meal`: unique `(userId, loggedDate, type)`.
- `CoachRequest`: unique `(traineeId, coachId)`.

## 1. ERD tổng quan toàn hệ thống

```mermaid
erDiagram
  USER {
    String id PK
    String supabaseAuthUserId UK
    String email UK
    String username UK
    String phone UK
    UserRole role
    String coachId FK
  }

  EXERCISE {
    String id PK
    String createdById FK
  }

  VARIATION {
    String id PK
    String exerciseId FK
  }

  EXERCISE_IMPORT_REQUEST {
    String id PK
    String submittedById FK
    String reviewedById FK
  }

  FOOD {
    String id PK
    String slug UK
    String barcode UK
    String createdById FK
  }

  MEAL {
    String id PK
    String userId FK
  }

  MEAL_FOOD_ITEM {
    String id PK
    String mealId FK
    String foodId FK
  }

  PROGRAM {
    String id PK
    String createdById FK
  }

  PROGRAM_ASSIGNMENT {
    String id PK
    String programId FK
    String userId FK
  }

  WORKOUT {
    String id PK
    String programId FK
  }

  WORKOUT_EXERCISE {
    String id PK
    String workoutId FK
    String variationId FK
  }

  EXERCISE_SET {
    String id PK
    String workoutExerciseId FK
  }

  WORKOUT_LOG {
    String id PK
    String userId FK
    String workoutId FK
    String programId
  }

  WORKOUT_LOG_COMMENT {
    String id PK
    String workoutLogId FK
    String authorId FK
  }

  BODY_METRIC_ENTRY {
    String id PK
    String traineeId FK
    String coachId FK
  }

  COACH_CHECK_IN {
    String id PK
    String traineeId FK
    String coachId FK
  }

  COACH_REQUEST {
    String id PK
    String traineeId FK
    String coachId FK
  }

  NOTIFICATION {
    String id PK
    String userId FK
  }

  ADMIN_AUDIT_LOG {
    String id PK
    String adminId FK
  }

  AI_GENERATION {
    String id PK
    String userId FK
    String programId
  }

  USER |o--o{ USER : coaches
  USER |o--o{ EXERCISE : creates
  EXERCISE ||--o{ VARIATION : has
  USER ||--o{ EXERCISE_IMPORT_REQUEST : submits
  USER |o--o{ EXERCISE_IMPORT_REQUEST : reviews
  USER |o--o{ FOOD : creates
  USER ||--o{ MEAL : logs
  MEAL ||--o{ MEAL_FOOD_ITEM : contains
  FOOD ||--o{ MEAL_FOOD_ITEM : used_by
  USER ||--o{ PROGRAM : creates
  PROGRAM ||--o{ PROGRAM_ASSIGNMENT : assigned_through
  USER ||--o{ PROGRAM_ASSIGNMENT : receives
  PROGRAM |o--o{ WORKOUT : contains
  WORKOUT ||--o{ WORKOUT_EXERCISE : contains
  VARIATION ||--o{ WORKOUT_EXERCISE : selected
  WORKOUT_EXERCISE ||--o{ EXERCISE_SET : has
  USER ||--o{ WORKOUT_LOG : logs
  WORKOUT |o--o{ WORKOUT_LOG : source
  WORKOUT_LOG ||--o{ WORKOUT_LOG_COMMENT : has
  USER ||--o{ WORKOUT_LOG_COMMENT : authors
  USER ||--o{ BODY_METRIC_ENTRY : trainee_metrics
  USER |o--o{ BODY_METRIC_ENTRY : coach_recorded
  USER ||--o{ COACH_CHECK_IN : trainee_checkins
  USER ||--o{ COACH_CHECK_IN : coach_checkins
  USER ||--o{ COACH_REQUEST : trainee_requests
  USER ||--o{ COACH_REQUEST : coach_requests
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ ADMIN_AUDIT_LOG : writes
  USER ||--o{ AI_GENERATION : owns
```

## 2. ERD chi tiết - Identity và platform

```mermaid
erDiagram
  USER {
    String id PK
    String supabaseAuthUserId_nullable UK
    String name
    String email UK
    String username_nullable UK
    String phone_nullable UK
    UserRole role
    Boolean isActive
    String avatar_nullable
    StringArray fitnessGoals
    WeightUnit preferredWeightUnit
    Int dailyCalorieGoal
    Int dailyProteinGoal
    Int dailyCarbsGoal
    Int dailyFatGoal
    Float heightCm_nullable
    Float targetWeightKg_nullable
    String coachId_nullable FK
    DateTime createdAt
    DateTime updatedAt
  }

  NOTIFICATION {
    String id PK
    String userId FK
    NotificationType type
    NotificationChannel channel
    NotificationStatus status
    String title
    String message
    DateTime scheduledFor
    DateTime sentAt_nullable
    DateTime readAt_nullable
    String relatedEntityType_nullable
    String relatedEntityId_nullable
    Json metadata_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  ADMIN_AUDIT_LOG {
    String id PK
    String adminId FK
    String action
    String entityType
    String entityId_nullable
    String entityLabel_nullable
    Json metadata_nullable
    DateTime createdAt
  }

  AI_GENERATION {
    String id PK
    String userId FK
    AIGenerationType type
    AIGenerationStatus status
    Json input
    Json output_nullable
    String programId_nullable
    Int tokenUsage_nullable
    String errorMsg_nullable
    DateTime createdAt
  }

  PROGRAM {
    String id PK
    String createdById FK
    String name
    Boolean isAIGenerated
  }

  USER |o--o{ USER : coach_trainees
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ ADMIN_AUDIT_LOG : writes
  USER ||--o{ AI_GENERATION : owns
```

## 3. ERD chi tiết - Exercise, program và workout

```mermaid
erDiagram
  USER {
    String id PK
    UserRole role
  }

  EXERCISE {
    String id PK
    String name
    String muscleGroup
    String createdById_nullable FK
    DateTime createdAt
    DateTime updatedAt
  }

  VARIATION {
    String id PK
    String exerciseId FK
    String name
    String equipment_nullable
    Boolean isDefault
    Int sortOrder
    Json metadata_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  PROGRAM {
    String id PK
    String name
    String description_nullable
    Int duration
    ProgramDifficulty difficulty
    Int workoutsPerWeek
    Boolean isAIGenerated
    String createdById FK
    DateTime archivedAt_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  PROGRAM_ASSIGNMENT {
    String id PK
    String programId FK
    String userId FK
    DateTime assignedAt
  }

  WORKOUT {
    String id PK
    String programId_nullable FK
    String name
    WorkoutKind kind_nullable
    Int weekIndex_nullable
    Int scheduledDay_nullable
    DateTime scheduledDate_nullable
    Int duration_nullable
    String notes_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  WORKOUT_EXERCISE {
    String id PK
    String workoutId FK
    String variationId FK
    Int order
    Int restTime_nullable
    String notes_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  EXERCISE_SET {
    String id PK
    String workoutExerciseId FK
    Int setNumber
    Int targetRepsMin_nullable
    Int targetReps
    Int actualReps_nullable
    Float weight_nullable
    Int rir_nullable
    String notes_nullable
    Boolean completed
  }

  WORKOUT_LOG {
    String id PK
    String userId FK
    String workoutId_nullable FK
    String programId_nullable
    Json workoutSnapshot_nullable
    Json exerciseSnapshot_nullable
    DateTime plannedDate_nullable
    DateTime startedAt
    DateTime completedAt_nullable
    Float totalVolume_nullable
    String notes_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  WORKOUT_LOG_COMMENT {
    String id PK
    String workoutLogId FK
    String authorId FK
    String content
    DateTime createdAt
    DateTime updatedAt
  }

  USER |o--o{ EXERCISE : creates
  EXERCISE ||--o{ VARIATION : has
  USER ||--o{ PROGRAM : creates
  PROGRAM ||--o{ PROGRAM_ASSIGNMENT : assigned_through
  USER ||--o{ PROGRAM_ASSIGNMENT : receives
  PROGRAM |o--o{ WORKOUT : contains
  WORKOUT ||--o{ WORKOUT_EXERCISE : contains
  VARIATION ||--o{ WORKOUT_EXERCISE : selected
  WORKOUT_EXERCISE ||--o{ EXERCISE_SET : has
  USER ||--o{ WORKOUT_LOG : logs
  WORKOUT |o--o{ WORKOUT_LOG : source
  WORKOUT_LOG ||--o{ WORKOUT_LOG_COMMENT : has
  USER ||--o{ WORKOUT_LOG_COMMENT : authors
```

## 4. ERD chi tiết - Nutrition

```mermaid
erDiagram
  USER {
    String id PK
    String name
    UserRole role
  }

  FOOD {
    String id PK
    String slug UK
    String name
    FoodCategory category
    String brand_nullable
    String barcode_nullable UK
    Float servingAmount
    String servingUnit
    String servingLabel
    Float calories
    Float protein_nullable
    Float carbs_nullable
    Float fat_nullable
    Float fiber_nullable
    Float sugar_nullable
    Float sodium_nullable
    FoodSource source
    Boolean isVerified
    String createdById_nullable FK
    DateTime createdAt
    DateTime updatedAt
  }

  MEAL {
    String id PK
    String userId FK
    MealType type
    String name
    DateTime loggedDate
    Float calories
    Float protein_nullable
    Float carbs_nullable
    Float fat_nullable
    Float fiber_nullable
    Float sugar_nullable
    Float sodium_nullable
    DateTime recordedAt
    DateTime createdAt
    DateTime updatedAt
  }

  MEAL_FOOD_ITEM {
    String id PK
    String mealId FK
    String foodId FK
    Float quantity
    Float amountValue
    String amountUnit
    String amountLabel_nullable
    Float weightGrams_nullable
    String notes_nullable
    String foodNameSnapshot_nullable
    Float calories
    Float protein_nullable
    Float carbs_nullable
    Float fat_nullable
    Float fiber_nullable
    Float sugar_nullable
    Float sodium_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  USER |o--o{ FOOD : creates
  USER ||--o{ MEAL : logs
  MEAL ||--o{ MEAL_FOOD_ITEM : contains
  FOOD ||--o{ MEAL_FOOD_ITEM : used_by
```

## 5. ERD chi tiết - Coaching và progress

```mermaid
erDiagram
  USER {
    String id PK
    String name
    UserRole role
    String coachId_nullable FK
  }

  BODY_METRIC_ENTRY {
    String id PK
    String traineeId FK
    String coachId_nullable FK
    DateTime recordedAt
    Float weightKg_nullable
    Float bodyFatPct_nullable
    Float chestCm_nullable
    Float waistCm_nullable
    Float hipsCm_nullable
    Float armCm_nullable
    Float thighCm_nullable
    String note_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  COACH_CHECK_IN {
    String id PK
    String traineeId FK
    String coachId FK
    DateTime checkInDate
    Int adherenceScore_nullable
    Int energyScore_nullable
    Int recoveryScore_nullable
    Int moodScore_nullable
    String summary_nullable
    String feedback
    String nextFocus_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  COACH_REQUEST {
    String id PK
    String traineeId FK
    String coachId FK
    CoachRequestStatus status
    DateTime createdAt
    DateTime updatedAt
  }

  USER |o--o{ USER : coach_trainees
  USER ||--o{ BODY_METRIC_ENTRY : trainee
  USER |o--o{ BODY_METRIC_ENTRY : coach
  USER ||--o{ COACH_CHECK_IN : trainee
  USER ||--o{ COACH_CHECK_IN : coach
  USER ||--o{ COACH_REQUEST : trainee
  USER ||--o{ COACH_REQUEST : coach
```

## 6. ERD chi tiết - Admin và exercise import

```mermaid
erDiagram
  USER {
    String id PK
    String name
    String email UK
    UserRole role
  }

  EXERCISE_IMPORT_REQUEST {
    String id PK
    String submittedById FK
    String reviewedById_nullable FK
    ExerciseImportRequestStatus status
    String fileName_nullable
    Int rowCount
    Json rows
    String reviewNote_nullable
    Json result_nullable
    DateTime reviewedAt_nullable
    DateTime createdAt
    DateTime updatedAt
  }

  ADMIN_AUDIT_LOG {
    String id PK
    String adminId FK
    String action
    String entityType
    String entityId_nullable
    String entityLabel_nullable
    Json metadata_nullable
    DateTime createdAt
  }

  USER ||--o{ EXERCISE_IMPORT_REQUEST : submits
  USER |o--o{ EXERCISE_IMPORT_REQUEST : reviews
  USER ||--o{ ADMIN_AUDIT_LOG : writes
```

## 7. Traceability to 6 main use cases

ERD là sơ đồ database nên vẫn phản ánh bảng, cột, khóa chính và khóa ngoại thật trong Prisma schema. Bảng dưới đây map entity chính sang 6 use case để đồng bộ với tài liệu use case và sequence.

| Use case chính | Entity/bảng chính | Quan hệ dữ liệu đáng chú ý |
|---|---|---|
| UC-01 - Đăng ký tài khoản | `USER` | `USER.supabaseAuthUserId` liên kết logic với Supabase Auth user; `email`, `username`, `phone` có unique constraint. |
| UC-02 - Đăng nhập | `USER`, `NOTIFICATION` | `USER.role` và `USER.isActive` quyết định phân quyền; `NOTIFICATION.userId` lưu thông báo hiển thị sau đăng nhập. |
| UC-03 - Trainee thực hiện và ghi log buổi tập | `EXERCISE`, `VARIATION`, `PROGRAM`, `PROGRAM_ASSIGNMENT`, `WORKOUT`, `WORKOUT_EXERCISE`, `EXERCISE_SET`, `WORKOUT_LOG`, `WORKOUT_LOG_COMMENT` | `WORKOUT` chứa `WORKOUT_EXERCISE`; `WORKOUT_EXERCISE` chứa `EXERCISE_SET`; `WORKOUT_LOG.userId` lưu trainee log; `WORKOUT_LOG.workoutId` là nguồn workout nullable. |
| UC-04 - Trainee ghi nhận dinh dưỡng và theo dõi tiến độ | `USER`, `FOOD`, `MEAL`, `MEAL_FOOD_ITEM`, `BODY_METRIC_ENTRY`, `WORKOUT_LOG`, `AI_GENERATION` | `MEAL` unique theo `(userId, loggedDate, type)`; `MEAL_FOOD_ITEM` nối `MEAL` và `FOOD`; `BODY_METRIC_ENTRY.traineeId` lưu progress; AI meal plan lưu ở `AI_GENERATION`. |
| UC-05 - Coach quản lý giáo án và trainee | `USER`, `COACH_REQUEST`, `PROGRAM`, `PROGRAM_ASSIGNMENT`, `WORKOUT`, `WORKOUT_LOG`, `WORKOUT_LOG_COMMENT`, `BODY_METRIC_ENTRY`, `COACH_CHECK_IN`, `EXERCISE`, `VARIATION`, `EXERCISE_IMPORT_REQUEST`, `NOTIFICATION`, `AI_GENERATION` | `USER.coachId` là quan hệ coach-trainee; `COACH_REQUEST` unique theo `(traineeId, coachId)`; `PROGRAM_ASSIGNMENT` unique theo `(programId, userId)`; coach comment/check-in/progress dùng các FK về `USER`. |
| UC-06 - Admin quản trị hệ thống | `USER`, `COACH_REQUEST`, `PROGRAM`, `EXERCISE`, `VARIATION`, `EXERCISE_IMPORT_REQUEST`, `ADMIN_AUDIT_LOG` | Admin cập nhật user/connection/request/program/exercise và ghi `ADMIN_AUDIT_LOG.adminId`; review import dùng `EXERCISE_IMPORT_REQUEST.reviewedById`. |

Ghi chú đồng bộ:

- Resume/discard workout là trạng thái client-only trong `localStorage`, không có bảng riêng trong ERD.
- Export workout logs dùng dữ liệu `WORKOUT_LOG` và tích hợp n8n/Google Sheets, không có bảng export riêng.
- Profile/avatar/nutrition targets nằm trong entity `USER`.
- `AI_GENERATION.programId` là logical reference trong schema hiện tại, không phải Prisma relation.
