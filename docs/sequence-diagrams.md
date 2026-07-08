# Sequence Diagrams - YeahBuddy Fitness

Tài liệu này mô tả 6 sơ đồ tuần tự chính tương ứng 6 use case chính của hệ thống YeahBuddy Fitness bằng Mermaid `sequenceDiagram`. Các luồng profile, resume workout, notification, AI, export và exercise import được mô tả bằng `opt` / `alt` trong UC liên quan, không tách thành sequence chính riêng.

Nguồn đối chiếu: `docs/use-case-diagrams.md`, `backend/prisma/schema.prisma`, `backend/src/routes/*`, `lib/*/api.ts`.

Quy ước participant:

- `Browser`: người dùng thao tác trên UI Next.js.
- `Next.js`: App Router, client components, server components, route guards và proxy `/backend/*`.
- `Express API`: backend Express mount route dưới `/api`.
- `Service`: lớp business logic trong `backend/src/services/*`.
- `Prisma`: Prisma Client.
- `PostgreSQL`: database Supabase Postgres.
- `Supabase Auth` và `Supabase Storage`: dịch vụ ngoài của Supabase.

## UC-01 - Đăng ký tài khoản

```mermaid
sequenceDiagram
  autonumber
  actor Visitor as Khách truy cập
  participant Browser as Browser
  participant Next as Next.js Frontend
  participant API as Express API
  participant AuthService as Auth Service
  participant SupabaseAuth as Supabase Auth
  participant Prisma as Prisma
  participant DB as PostgreSQL

  Visitor->>Browser: Nhập name, email, username, phone, password, role
  Browser->>Next: Submit register form
  Next->>API: POST /api/auth/register
  API->>AuthService: registerUser(payload)
  AuthService->>AuthService: Validate role, unique fields, password input
  AuthService->>SupabaseAuth: signUp(email, password, metadata)
  alt Supabase yêu cầu xác nhận email
    SupabaseAuth-->>AuthService: auth user, no active session
    AuthService-->>API: requiresEmailConfirmation = true
    API-->>Next: 202 Accepted
    Next-->>Browser: Hiển thị yêu cầu kiểm tra email
  else Có session ngay
    SupabaseAuth-->>AuthService: session, auth user
    AuthService->>Prisma: create User profile
    Prisma->>DB: INSERT users
    DB-->>Prisma: created user
    Prisma-->>AuthService: profile
    AuthService-->>API: profile, session
    API-->>Next: 201 Created
    Next->>Next: Đọc profile.role
    alt role = trainee
      Next-->>Browser: Redirect /dashboard
    else role = coach
      Next-->>Browser: Redirect /coach
    else role = admin
      Next-->>Browser: Redirect /admin
    end
  end
```

## UC-02 - Đăng nhập

```mermaid
sequenceDiagram
  autonumber
  actor User as Người dùng
  participant Browser as Browser
  participant Next as Next.js App Router
  participant SupabaseSSR as Supabase SSR Client
  participant API as Express API
  participant AuthService as Auth Service
  participant SupabaseAuth as Supabase Auth
  participant Storage as Supabase Storage
  participant FitnessService as Fitness Data Service
  participant AdminService as Admin Service
  participant Prisma as Prisma
  participant DB as PostgreSQL

  User->>Browser: Nhập email, username hoặc phone và password
  Browser->>Next: Submit login form
  Next->>API: POST /api/auth/login
  API->>AuthService: loginUser(identifier, password)
  AuthService->>SupabaseAuth: signInWithPassword()
  SupabaseAuth-->>AuthService: session, auth user
  AuthService->>Prisma: find/upsert User profile
  Prisma->>DB: SELECT/INSERT/UPDATE users
  DB-->>Prisma: profile
  Prisma-->>AuthService: profile
  AuthService-->>API: profile, session
  API-->>Next: login response
  Next->>Browser: Lưu Supabase session cookie

  User->>Browser: Truy cập route được bảo vệ
  Browser->>Next: Request /dashboard, /coach hoặc /admin
  Next->>SupabaseSSR: Đọc session từ cookie
  SupabaseSSR-->>Next: access token
  Next->>API: GET /api/auth/me
  API->>AuthService: getCurrentProfile(accessToken)
  AuthService->>Prisma: Load local User profile
  Prisma->>DB: SELECT users
  DB-->>Prisma: profile
  Prisma-->>AuthService: profile
  AuthService-->>API: profile
  API-->>Next: profile
  alt role = trainee
    Next->>API: GET /api/dashboard
    API->>FitnessService: getDashboardForTrainee(profile)
    FitnessService->>Prisma: Query trainee dashboard data
    Prisma->>DB: SELECT workouts, logs, meals, metrics
    DB-->>Prisma: rows
    Prisma-->>FitnessService: dashboard
    FitnessService-->>API: dashboard
    API-->>Next: dashboard
    Next-->>Browser: Render /dashboard
  else role = coach
    Next->>API: GET /api/coach/dashboard
    API->>FitnessService: getCoachDashboard(profile)
    FitnessService->>Prisma: Query trainees, logs, requests
    Prisma->>DB: SELECT coach domain data
    DB-->>Prisma: rows
    FitnessService-->>API: dashboard
    API-->>Next: dashboard
    Next-->>Browser: Render /coach
  else role = admin
    Next->>API: GET /api/admin/dashboard
    API->>AdminService: getAdminDashboard(profile)
    AdminService->>Prisma: Query platform metrics
    Prisma->>DB: SELECT users, programs, requests, logs
    DB-->>Prisma: rows
    AdminService-->>API: dashboard
    API-->>Next: dashboard
    Next-->>Browser: Render /admin
  end

  opt Người dùng cập nhật profile hoặc avatar sau đăng nhập
    Browser->>Next: Submit profile form
    Next->>API: PATCH /api/auth/me
    API->>AuthService: updateCurrentProfile(accessToken, payload)
    AuthService->>Prisma: UPDATE users
    Prisma->>DB: updated profile
    Prisma-->>AuthService: profile
    AuthService-->>API: profile
    API-->>Next: profile
    Browser->>Next: Upload avatar image
    Next->>API: POST /api/auth/me/avatar
    API->>AuthService: uploadCurrentProfileAvatar(dataUrl)
    AuthService->>Storage: Upload avatar
    Storage-->>AuthService: public URL
    AuthService->>Prisma: UPDATE users.avatar
    Prisma->>DB: updated profile
    AuthService-->>API: profile
    API-->>Next: profile
  end

  opt Session phụ trợ
    Next->>API: POST /api/auth/refresh
    API->>AuthService: refreshAuthSession(accessToken, refreshToken)
    AuthService->>SupabaseAuth: refresh session
    SupabaseAuth-->>AuthService: new session
    AuthService-->>API: session
    API-->>Next: session
  end

  opt App shell tải notification sau đăng nhập
    Next->>API: GET /api/notifications?limit=20
    API->>AuthService: requireCurrentProfile()
    AuthService-->>API: profile
    API->>FitnessService: listNotificationsForUser()
    FitnessService->>Prisma: SELECT notifications by userId
    Prisma->>DB: notifications
    FitnessService-->>API: notifications and unread count
    API-->>Next: data
    alt Đánh dấu một notification đã đọc
      Next->>API: PATCH /api/notifications/:notificationId/read
      API->>FitnessService: markNotificationAsReadForUser()
      FitnessService->>Prisma: UPDATE notifications.readAt
      Prisma->>DB: notification
      FitnessService-->>API: notification
      API-->>Next: notification
    else Đánh dấu tất cả đã đọc
      Next->>API: POST /api/notifications/read-all
      API->>FitnessService: markAllNotificationsAsReadForUser()
      FitnessService->>Prisma: UPDATE notifications where userId
      Prisma->>DB: update count
      FitnessService-->>API: result
      API-->>Next: result
    end
  end
```

## UC-03 - Trainee thực hiện và ghi log buổi tập

```mermaid
sequenceDiagram
  autonumber
  actor Trainee as Trainee
  participant Browser as Browser
  participant LocalStorage as Browser localStorage
  participant Shell as App Shell
  participant Next as Next.js Frontend
  participant API as Express API
  participant AuthService as Auth Service
  participant FitnessService as Fitness Data Service
  participant ExportService as n8n Export Service
  participant Prisma as Prisma
  participant DB as PostgreSQL
  participant N8N as n8n Webhook

  opt Trainee tạo workout cá nhân trước khi tập
    Trainee->>Browser: Mở /workout và tạo workout
    Next->>API: GET /api/exercises/library
    API->>AuthService: requireCurrentProfile()
    AuthService-->>API: trainee profile
    API->>FitnessService: listExerciseLibrary()
    FitnessService->>Prisma: Query Exercise và Variation
    Prisma->>DB: SELECT exercises, variations
    DB-->>Prisma: exercise library
    FitnessService-->>API: exercises
    API-->>Next: exercise options
    Trainee->>Browser: Submit workout builder
    Next->>API: POST /api/workouts
    API->>FitnessService: createPersonalWorkoutForTrainee()
    FitnessService->>Prisma: Transaction create Workout tree
    Prisma->>DB: INSERT workouts, workout_exercises, exercise_sets
    DB-->>Prisma: created workout
    FitnessService-->>API: workout
    API-->>Next: 201 Created
  end

  Trainee->>Browser: Chọn workout và bấm Start
  Browser->>Next: Navigate /workout/[id]/start
  Next->>API: GET /api/workouts/:workoutId
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: trainee profile
  API->>FitnessService: getWorkoutDetailForTrainee()
  FitnessService->>Prisma: Load workout, exercises, sets
  Prisma->>DB: SELECT workout tree
  DB-->>Prisma: workout detail
  FitnessService-->>API: workout detail
  API-->>Next: workout detail
  Next-->>Browser: Render workout logger
  Browser->>LocalStorage: readStoredWorkoutSession(workoutId)
  alt Có session cùng schemaVersion
    LocalStorage-->>Browser: stored exercises, index, startedAt
    Browser->>Browser: Restore set progress và current exercise
  else Không có session hợp lệ
    Browser->>Browser: Khởi tạo session mới
  end

  loop Mỗi set trong buổi tập
    Trainee->>Browser: Nhập reps, weight, RIR, completed
    Browser->>Browser: Tính volume tạm thời, rest timer, PR hint
    Browser->>LocalStorage: setItem(workout-session:workoutId)
  end

  opt Trainee rời route khi đang tập
    Shell->>LocalStorage: scanActiveSessions()
    LocalStorage-->>Shell: active session mới nhất
    Shell-->>Browser: Hiển thị floating resume card
    alt Trainee bấm Resume
      Browser->>Next: router.push(/workout/:workoutId/start)
      Next->>API: GET /api/workouts/:workoutId
      API->>FitnessService: getWorkoutDetailForTrainee()
      FitnessService->>Prisma: SELECT workout tree
      Prisma->>DB: workout detail
      API-->>Next: workout detail
      Browser->>LocalStorage: readStoredWorkoutSession(workoutId)
      LocalStorage-->>Browser: stored progress
      Browser->>Browser: Restore để tập tiếp
    else Trainee bấm Discard
      Browser->>LocalStorage: clearStoredWorkoutSession(workoutId)
      Browser->>Shell: Ẩn resume card
    end
  end

  Trainee->>Browser: Hoàn tất buổi tập
  Browser->>Next: Submit workout log payload
  Next->>API: POST /api/workouts/:workoutId/logs
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: trainee profile
  API->>FitnessService: createWorkoutLogForTrainee()
  FitnessService->>FitnessService: Build workoutSnapshot, exerciseSnapshot, totalVolume
  FitnessService->>Prisma: Transaction create WorkoutLog
  Prisma->>DB: INSERT workout_logs
  DB-->>Prisma: workout log
  FitnessService-->>API: log
  API-->>Next: 201 Created
  Browser->>LocalStorage: clearStoredWorkoutSession(workoutId)
  Next-->>Browser: Cập nhật history và progress

  opt Xem detail, xóa log hoặc export
    Next->>API: GET /api/progress/workout-log/:logId
    API->>FitnessService: getWorkoutLogDetailForTrainee()
    FitnessService->>Prisma: SELECT workout_log detail
    Prisma->>DB: log detail
    API-->>Next: log detail
    Next->>API: DELETE /api/workouts/:workoutId/logs/:logId
    API->>FitnessService: deleteWorkoutLogForTrainee()
    FitnessService->>Prisma: DELETE workout_logs
    Prisma->>DB: delete result
    Next->>API: POST /api/workouts/logs/export/google-sheets
    API->>FitnessService: exportWorkoutLogsToGoogleSheetsForTrainee()
    FitnessService->>Prisma: SELECT logs for export
    Prisma->>DB: export rows
    FitnessService->>ExportService: Format rows
    ExportService->>N8N: POST webhook payload
    N8N-->>ExportService: webhook response
    ExportService-->>FitnessService: result
    FitnessService-->>API: export result
    API-->>Next: data
  end
```

## UC-04 - Trainee ghi nhận dinh dưỡng và theo dõi tiến độ

```mermaid
sequenceDiagram
  autonumber
  actor Trainee as Trainee
  participant Browser as Browser
  participant Next as Next.js Frontend
  participant API as Express API
  participant AuthService as Auth Service
  participant NutritionService as Nutrition Service
  participant FitnessService as Fitness Data Service
  participant AIService as AI Service
  participant AIProvider as OpenAI or Anthropic
  participant USDA as USDA API
  participant Prisma as Prisma
  participant DB as PostgreSQL

  Trainee->>Browser: Mở /meals theo ngày
  Next->>API: GET /api/meals?date=YYYY-MM-DD
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: trainee profile
  API->>NutritionService: listNutritionDayForUser()
  NutritionService->>Prisma: Query meals, meal items, user targets
  Prisma->>DB: SELECT meals, foods, users
  DB-->>Prisma: nutrition rows
  NutritionService->>NutritionService: Tính totals và calories left
  NutritionService-->>API: nutrition day
  API-->>Next: data
  Next-->>Browser: Render daily nutrition

  Trainee->>Browser: Tìm food
  Next->>API: GET /api/foods?query=...
  API->>NutritionService: listFoodsForUser()
  NutritionService->>Prisma: Search local foods
  Prisma->>DB: SELECT foods
  DB-->>Prisma: foods
  alt Không đủ kết quả local và có USDA key
    NutritionService->>USDA: Search FoodData Central
    USDA-->>NutritionService: external foods
  end
  NutritionService-->>API: foods
  API-->>Next: foods
  Next-->>Browser: Hiển thị food picker

  alt Trainee tạo food cá nhân
    Trainee->>Browser: Nhập food custom
    Next->>API: POST /api/foods
    API->>NutritionService: createFoodForUser()
    NutritionService->>Prisma: INSERT foods
    Prisma->>DB: created food
    NutritionService-->>API: food
    API-->>Next: 201 Created
  else Trainee chọn food có sẵn
    Trainee->>Browser: Chọn food, quantity, meal type
  end

  Next->>API: POST /api/meals/items
  API->>NutritionService: addMealItemForUser()
  NutritionService->>Prisma: Upsert Meal và create MealFoodItem
  Prisma->>DB: INSERT/UPDATE meals, meal_food_items
  DB-->>Prisma: updated meal
  NutritionService-->>API: meal
  API-->>Next: 201 Created
  Next-->>Browser: Refresh totals và meal list

  opt Xóa meal item hoặc cập nhật nutrition targets
    Next->>API: DELETE /api/meals/items/:itemId
    API->>NutritionService: deleteMealItemForUser()
    NutritionService->>Prisma: DELETE meal_food_items
    Prisma->>DB: updated meal
    API-->>Next: meal
    Next->>API: PATCH /api/auth/me
    API->>AuthService: updateCurrentProfile(dailyCalorieGoal, dailyProteinGoal, dailyCarbsGoal, dailyFatGoal)
    AuthService->>Prisma: UPDATE users
    Prisma->>DB: updated targets
  end

  opt AI meal plan
    Trainee->>Browser: Nhập mục tiêu meal plan
    Next->>API: POST /api/ai/generate-meal-plan
    API->>AIService: generateMealPlan(profile, input)
    AIService->>Prisma: INSERT ai_generations pending
    Prisma->>DB: generation
    AIService->>AIProvider: Generate structured meal plan
    AIProvider-->>AIService: meal plan output and token usage
    AIService->>Prisma: UPDATE ai_generations completed
    Prisma->>DB: completed generation
    AIService-->>API: preview
    API-->>Next: 201 Created
    Trainee->>Browser: Accept meal plan
    Next->>API: POST /api/ai/accept-meal-plan
    API->>AIService: acceptAIMealPlan(generationId, date)
    AIService->>Prisma: Transaction create meals and meal items
    Prisma->>DB: INSERT meals, meal_food_items, foods if needed
    AIService->>Prisma: UPDATE ai_generations accepted
    Prisma->>DB: accepted generation
    AIService-->>API: nutrition day
    API-->>Next: data
  end

  Trainee->>Browser: Mở /trackweight hoặc /progress
  Next->>API: GET /api/progress/weight
  API->>FitnessService: listBodyMetricsForCurrentTrainee()
  FitnessService->>Prisma: SELECT body_metric_entries
  Prisma->>DB: metrics
  FitnessService-->>API: bodyMetrics
  API-->>Next: bodyMetrics
  Trainee->>Browser: Nhập cân nặng mới
  Next->>API: POST /api/progress/weight
  API->>FitnessService: createBodyMetricForCurrentTrainee()
  FitnessService->>Prisma: INSERT body_metric_entries
  Prisma->>DB: bodyMetric
  FitnessService-->>API: bodyMetric
  API-->>Next: 201 Created
  Next->>API: GET /api/progress/analytics
  API->>FitnessService: getProgressAnalyticsForCurrentTrainee()
  FitnessService->>Prisma: Query workout logs and metrics
  Prisma->>DB: analytics rows
  FitnessService->>FitnessService: Tính volume, frequency, estimated 1RM
  FitnessService-->>API: analytics
  API-->>Next: analytics
  Next->>API: GET /api/progress/calendar?year=YYYY&month=MM
  API->>FitnessService: getCalendarForTrainee()
  FitnessService->>Prisma: Query calendar rows
  Prisma->>DB: rows
  API-->>Next: calendar
```

## UC-05 - Coach quản lý giáo án và trainee

```mermaid
sequenceDiagram
  autonumber
  actor Trainee as Trainee
  actor Coach as Coach
  participant Browser as Browser
  participant Next as Next.js Frontend
  participant API as Express API
  participant AuthService as Auth Service
  participant FitnessService as Fitness Data Service
  participant AIService as AI Service
  participant AIProvider as OpenAI or Anthropic
  participant ExportService as n8n Export Service
  participant Prisma as Prisma
  participant DB as PostgreSQL
  participant N8N as n8n Webhook
  participant Sheets as Google Sheets

  Trainee->>Browser: Mở /coach/find
  Next->>API: GET /api/coach/discover
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: trainee profile
  API->>FitnessService: listAvailableCoachesForTrainee()
  FitnessService->>Prisma: SELECT users where role = coach
  Prisma->>DB: coach list
  FitnessService-->>API: coaches
  API-->>Next: coaches
  Trainee->>Browser: Gửi request tới coach
  Next->>API: POST /api/coach/requests
  API->>FitnessService: createCoachRequestForTrainee()
  FitnessService->>Prisma: INSERT coach_requests
  Prisma->>DB: pending request
  FitnessService-->>API: request
  API-->>Next: 201 Created

  Coach->>Browser: Mở coach dashboard
  Next->>API: GET /api/coach/dashboard
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: coach profile
  API->>FitnessService: getCoachDashboard()
  FitnessService->>Prisma: Query trainees, pending requests, recent logs
  Prisma->>DB: dashboard rows
  FitnessService-->>API: dashboard
  API-->>Next: dashboard
  Coach->>Browser: Approve hoặc reject request
  Next->>API: PATCH /api/coach/requests/:requestId
  API->>FitnessService: updateCoachRequestStatus()
  alt Approved
    FitnessService->>Prisma: Update request and set trainee.coachId
    Prisma->>DB: UPDATE coach_requests, users
  else Rejected
    FitnessService->>Prisma: Update request status rejected
    Prisma->>DB: UPDATE coach_requests
  end
  FitnessService-->>API: request
  API-->>Next: request

  Coach->>Browser: Tạo hoặc chỉnh giáo án
  Next->>API: GET /api/coach/exercises
  API->>FitnessService: listCoachExercises()
  FitnessService->>Prisma: SELECT exercises, variations
  Prisma->>DB: exercises
  Next->>API: GET /api/coach/trainees
  API->>FitnessService: listCoachTrainees()
  FitnessService->>Prisma: SELECT users where coachId = coach.id
  Prisma->>DB: trainees
  Coach->>Browser: Submit program builder
  Next->>API: POST /api/coach/programs
  API->>FitnessService: createCoachProgram()
  FitnessService->>Prisma: Transaction create Program tree
  Prisma->>DB: INSERT programs, workouts, workout_exercises, exercise_sets
  opt Coach assign trainee ngay
    Prisma->>DB: INSERT program_assignments
  end
  FitnessService-->>API: program
  API-->>Next: 201 Created

  opt Gán, hủy gán, archive, restore hoặc adjust giáo án
    Next->>API: POST /api/coach/programs/:programId/assignments
    API->>FitnessService: assignCoachProgramToTrainee()
    FitnessService->>Prisma: INSERT program_assignments
    Prisma->>DB: assignment
    Next->>API: DELETE /api/coach/programs/:programId/assignments/:traineeId
    API->>FitnessService: unassignCoachProgramFromTrainee()
    FitnessService->>Prisma: DELETE program_assignments
    Prisma->>DB: delete result
    Next->>API: POST /api/coach/programs/:programId/adjustments
    API->>FitnessService: adjustCoachProgramForTrainee()
    FitnessService->>Prisma: Transaction create adjusted Program tree
    Prisma->>DB: adjusted program
    Next->>API: POST /api/coach/programs/:programId/archive
    Next->>API: POST /api/coach/programs/:programId/restore
  end

  opt AI generate workout program
    Coach->>Browser: Nhập goal, level, schedule, constraints
    Next->>API: POST /api/ai/generate-program
    API->>AIService: generateWorkoutProgram(profile, input)
    AIService->>Prisma: INSERT ai_generations pending
    Prisma->>DB: generation
    AIService->>AIProvider: Generate structured workout program
    AIProvider-->>AIService: program output and token usage
    AIService->>Prisma: UPDATE ai_generations completed
    Prisma->>DB: completed generation
    AIService-->>API: preview
    API-->>Next: 201 Created
    Coach->>Browser: Accept program
    Next->>API: POST /api/ai/accept-program
    API->>AIService: acceptAIProgram(generationId)
    AIService->>Prisma: Transaction create Program tree
    Prisma->>DB: INSERT programs, workouts, workout_exercises, exercise_sets
    AIService->>Prisma: UPDATE ai_generations accepted
    Prisma->>DB: accepted generation
    AIService-->>API: program
    API-->>Next: program
  end

  Coach->>Browser: Mở /coach/trainees/:id
  Next->>API: GET /api/coach/trainees/:traineeId
  API->>FitnessService: getCoachTraineeDetail()
  FitnessService->>Prisma: Query trainee, programs, metrics, recent logs, nutrition summary
  Prisma->>DB: trainee detail
  FitnessService-->>API: detail
  API-->>Next: detail
  Next->>API: GET /api/coach/trainees/:traineeId/workout-logs
  API->>FitnessService: listCoachWorkoutLogsForTrainee()
  FitnessService->>Prisma: SELECT workout_logs
  Prisma->>DB: logs
  FitnessService-->>API: logs
  API-->>Next: logs

  opt Coach comment, ghi metrics hoặc check-in
    Next->>API: POST /api/coach/workout-logs/:workoutLogId/comments
    API->>FitnessService: createWorkoutLogCommentForCoach()
    FitnessService->>Prisma: INSERT workout_log_comments
    Prisma->>DB: comment
    Next->>API: POST /api/coach/trainees/:traineeId/body-metrics
    API->>FitnessService: createBodyMetricForTrainee()
    FitnessService->>Prisma: INSERT body_metric_entries
    Prisma->>DB: bodyMetric
    Next->>API: POST /api/coach/trainees/:traineeId/check-ins
    API->>FitnessService: createCoachCheckInForTrainee()
    FitnessService->>Prisma: INSERT coach_check_ins
    Prisma->>DB: checkIn
  end

  opt Coach export logs hoặc gửi import request exercise
    Next->>API: POST /api/coach/trainees/:traineeId/workout-logs/export/google-sheets
    API->>FitnessService: exportCoachWorkoutLogsToGoogleSheetsForTrainee()
    FitnessService->>Prisma: SELECT logs for export
    Prisma->>DB: export rows
    FitnessService->>ExportService: Format rows
    ExportService->>N8N: POST webhook payload
    N8N->>Sheets: Append rows
    Sheets-->>N8N: success
    ExportService-->>FitnessService: result
    FitnessService-->>API: export result
    Next->>API: POST /api/coach/exercise-import-requests
    API->>FitnessService: submitCoachExerciseImportRequest()
    FitnessService->>Prisma: INSERT exercise_import_requests
    Prisma->>DB: request pending
    FitnessService-->>API: request
    API-->>Next: 201 Created
  end
```

## UC-06 - Admin quản trị hệ thống

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Admin
  participant Browser as Browser
  participant Next as Next.js Frontend
  participant API as Express API
  participant AuthService as Auth Service
  participant AdminService as Admin Service
  participant SupabaseAuth as Supabase Auth
  participant Prisma as Prisma
  participant DB as PostgreSQL

  Admin->>Browser: Mở /admin
  Next->>API: GET /api/admin/dashboard
  API->>AuthService: requireCurrentProfile()
  AuthService-->>API: admin profile
  API->>AdminService: getAdminDashboard()
  AdminService->>Prisma: Query platform metrics
  Prisma->>DB: SELECT users, programs, requests, logs
  DB-->>Prisma: metrics rows
  AdminService-->>API: dashboard
  API-->>Next: dashboard
  Next-->>Browser: Render admin console

  Admin->>Browser: Tìm kiếm và cập nhật user
  Next->>API: GET /api/admin/users?role=...&search=...
  API->>AdminService: listAdminUsers()
  AdminService->>Prisma: SELECT users
  Prisma->>DB: users
  AdminService-->>API: users
  API-->>Next: users
  Next->>API: PATCH /api/admin/users/:userId
  API->>AdminService: updateAdminUser()
  AdminService->>Prisma: UPDATE users and INSERT admin_audit_logs
  Prisma->>DB: updated user, audit log
  AdminService-->>API: user
  API-->>Next: user

  opt Reset password user
    Next->>API: POST /api/admin/users/:userId/reset-password
    API->>AdminService: resetAdminUserPassword()
    AdminService->>SupabaseAuth: Update auth user password
    SupabaseAuth-->>AdminService: success
    AdminService->>Prisma: INSERT admin_audit_logs
    Prisma->>DB: audit log
    AdminService-->>API: result
    API-->>Next: result
  end

  opt Quản lý kết nối coach - trainee và coach request
    Next->>API: GET /api/admin/connections
    API->>AdminService: listAdminConnections()
    AdminService->>Prisma: SELECT coaches, trainees, connections
    Prisma->>DB: connection rows
    Next->>API: POST /api/admin/connections
    API->>AdminService: assignAdminCoachToTrainee()
    AdminService->>Prisma: UPDATE users.coachId and INSERT admin_audit_logs
    Prisma->>DB: connection, audit log
    Next->>API: DELETE /api/admin/connections/:traineeId
    API->>AdminService: removeAdminCoachFromTrainee()
    AdminService->>Prisma: UPDATE users.coachId null and INSERT admin_audit_logs
    Prisma->>DB: removal, audit log
    Next->>API: GET /api/admin/coach-requests
    API->>AdminService: listAdminCoachRequests()
    AdminService->>Prisma: SELECT coach_requests
    Prisma->>DB: requests
    Next->>API: PATCH /api/admin/coach-requests/:requestId
    API->>AdminService: updateAdminCoachRequest()
    AdminService->>Prisma: UPDATE coach_requests, users and INSERT admin_audit_logs
    Prisma->>DB: request result, audit log
  end

  opt Quản lý program và exercise library
    Next->>API: GET /api/admin/programs
    API->>AdminService: listAdminPrograms()
    AdminService->>Prisma: SELECT programs
    Prisma->>DB: programs
    Next->>API: DELETE /api/admin/programs/:programId
    API->>AdminService: deleteAdminProgram()
    AdminService->>Prisma: DELETE programs and INSERT admin_audit_logs
    Prisma->>DB: delete result
    Next->>API: GET /api/admin/exercises
    API->>AdminService: listAdminExercises()
    AdminService->>Prisma: SELECT exercises, variations
    Prisma->>DB: exercises
    Next->>API: POST /api/admin/exercises
    API->>AdminService: createAdminExercise()
    AdminService->>Prisma: INSERT exercises, variations and audit
    Prisma->>DB: exercise, audit log
    Next->>API: PATCH /api/admin/exercises/:exerciseId
    API->>AdminService: updateAdminExercise()
    AdminService->>Prisma: UPDATE exercises, variations and audit
    Prisma->>DB: exercise, audit log
    Next->>API: DELETE /api/admin/exercises/:exerciseId
    API->>AdminService: deleteAdminExercise()
    AdminService->>Prisma: DELETE exercise and INSERT admin_audit_logs
    Prisma->>DB: delete result
  end

  opt Import, sync, bulk delete và review exercise import request
    Next->>API: POST /api/admin/exercises/import
    API->>AdminService: importAdminExercises()
    AdminService->>Prisma: Transaction create Exercise and Variation rows
    Prisma->>DB: imported rows, audit log
    Next->>API: POST /api/admin/exercises/sync-preview
    API->>AdminService: previewExerciseSync()
    AdminService->>Prisma: SELECT exercises, variations
    Prisma->>DB: preview rows
    Next->>API: POST /api/admin/exercises/sync-apply
    API->>AdminService: applyExerciseSync()
    AdminService->>Prisma: Transaction upsert/delete exercise library rows
    Prisma->>DB: sync result, audit log
    Next->>API: POST /api/admin/exercises/bulk-delete
    API->>AdminService: bulkDeleteAdminExercises()
    AdminService->>Prisma: DELETE selected exercises and audit
    Prisma->>DB: bulk delete result
    Next->>API: GET /api/admin/exercise-import-requests
    API->>AdminService: listAdminExerciseImportRequests()
    AdminService->>Prisma: SELECT exercise_import_requests
    Prisma->>DB: pending requests
    Next->>API: PATCH /api/admin/exercise-import-requests/:requestId
    API->>AdminService: reviewExerciseImportRequest()
    AdminService->>Prisma: Update request, create Exercise/Variation if approved, write audit
    Prisma->>DB: review result, audit log
  end

  Admin->>Browser: Mở audit logs
  Next->>API: GET /api/admin/audit-logs
  API->>AdminService: listAdminAuditLogs()
  AdminService->>Prisma: SELECT admin_audit_logs
  Prisma->>DB: audit logs
  AdminService-->>API: logs
  API-->>Next: logs
  Next-->>Browser: Render audit table
```
