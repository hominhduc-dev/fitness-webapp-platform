# Use Case Diagrams - YeahBuddy Fitness

Tài liệu này mô tả các use case chính của hệ thống YeahBuddy Fitness bằng Mermaid. Các sơ đồ được tách theo actor và domain để dễ render, dễ đưa vào báo cáo hoặc tài liệu phân tích thiết kế.

Nguồn đối chiếu: `README.md`, `backend/prisma/schema.prisma`, các route trong `backend/src/routes/*`.

Ghi chú: Mermaid không có cú pháp UML use case native ổn định trên mọi viewer, nên tài liệu dùng `flowchart LR` với use case dạng oval và actor dạng node riêng.

Quy ước đọc sơ đồ:

- Đường liền: actor trực tiếp thực hiện use case.
- Đường chấm `include`: use case luôn gọi thêm use case phụ.
- Đường chấm `extend`: use case mở rộng tùy điều kiện.
- Node màu xám: hệ thống/tích hợp bên ngoài.

## 1. Tổng quan hệ thống

```mermaid
flowchart LR
  Visitor["Khách truy cập"]:::actor
  User["Người dùng đã đăng nhập"]:::actor
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  Admin["Admin"]:::actor

  SupabaseAuth["Supabase Auth"]:::external
  SupabaseStorage["Supabase Storage"]:::external
  Postgres["PostgreSQL trên Supabase"]:::external
  AIProvider["AI Provider"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph SYS["YeahBuddy Fitness"]
    Auth([Đăng ký, đăng nhập, khôi phục mật khẩu]):::usecase
    Profile([Quản lý hồ sơ cá nhân]):::usecase
    Dashboard([Xem dashboard theo vai trò]):::usecase
    Workout([Quản lý tập luyện và workout log]):::usecase
    Nutrition([Ghi nhận bữa ăn và macro]):::usecase
    Progress([Theo dõi tiến độ và body metrics]):::usecase
    Coaching([Quản lý coaching]):::usecase
    Programs([Xây dựng và gán giáo án]):::usecase
    Library([Quản lý thư viện bài tập và food]):::usecase
    AdminOps([Vận hành admin]):::usecase
    AI([Tạo giáo án, meal plan và chat AI]):::usecase
    Notification([Thông báo trong app]):::usecase
    Export([Xuất workout logs]):::usecase
  end

  Visitor --> Auth
  User --> Profile
  User --> Dashboard
  User --> Notification
  Trainee --> Workout
  Trainee --> Nutrition
  Trainee --> Progress
  Trainee --> Coaching
  Trainee --> AI
  Coach --> Coaching
  Coach --> Programs
  Coach --> Library
  Coach --> Progress
  Coach --> Export
  Admin --> AdminOps
  Admin --> Library

  Auth --> SupabaseAuth
  Profile --> SupabaseStorage
  Workout --> Postgres
  Nutrition --> Postgres
  Progress --> Postgres
  Coaching --> Postgres
  Programs --> Postgres
  AdminOps --> Postgres
  AI --> AIProvider
  AI --> Postgres
  Export --> N8N

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 2. Auth, session và profile

```mermaid
flowchart LR
  Visitor["Khách truy cập"]:::actor
  User["Người dùng đã đăng nhập"]:::actor
  Trainee["Trainee"]:::actor
  SupabaseAuth["Supabase Auth"]:::external
  Storage["Supabase Storage"]:::external
  DB["PostgreSQL"]:::external

  subgraph SYS["Auth & Profile"]
    Register([Đăng ký tài khoản]):::usecase
    Login([Đăng nhập bằng email, username hoặc phone]):::usecase
    OAuthCallback([Xử lý OAuth / email callback]):::usecase
    Refresh([Refresh session]):::usecase
    ForgotPassword([Gửi email khôi phục mật khẩu]):::usecase
    ResetPassword([Đặt mật khẩu mới]):::usecase
    SyncProfile([Đồng bộ Supabase user sang User profile]):::usecase
    GetMe([Xem hồ sơ hiện tại]):::usecase
    UpdateMe([Cập nhật hồ sơ, mục tiêu, đơn vị cân nặng]):::usecase
    UploadAvatar([Upload avatar]):::usecase
    Logout([Đăng xuất]):::usecase
    ResetTraineeData([Xóa dữ liệu trainee hiện tại]):::usecase
    Authorize([Kiểm tra session và phân quyền role]):::usecase
  end

  Visitor --> Register
  Visitor --> Login
  Visitor --> OAuthCallback
  Visitor --> ForgotPassword
  Visitor --> ResetPassword
  User --> Refresh
  User --> GetMe
  User --> UpdateMe
  User --> UploadAvatar
  User --> Logout
  Trainee --> ResetTraineeData

  Register -. include .-> SupabaseAuth
  Login -. include .-> SupabaseAuth
  OAuthCallback -. include .-> SupabaseAuth
  ForgotPassword -. include .-> SupabaseAuth
  ResetPassword -. include .-> SupabaseAuth
  Register -. include .-> SyncProfile
  Login -. include .-> SyncProfile
  SyncProfile --> DB
  GetMe -. include .-> Authorize
  UpdateMe -. include .-> Authorize
  UploadAvatar -. include .-> Authorize
  ResetTraineeData -. include .-> Authorize
  UploadAvatar --> Storage
  UpdateMe --> DB
  ResetTraineeData --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 3. Trainee - tập luyện, lịch tập và tiến độ

```mermaid
flowchart LR
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  DB["PostgreSQL"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph SYS["Trainee Workout & Progress"]
    ViewDashboard([Xem trainee dashboard]):::usecase
    ViewSchedule([Xem lịch tập tuần]):::usecase
    BrowseExercise([Tra cứu thư viện bài tập]):::usecase
    ManagePersonalWorkout([Tạo, sửa, xóa workout cá nhân]):::usecase
    ViewAssignedProgram([Xem giáo án được gán]):::usecase
    StartWorkout([Bắt đầu buổi tập]):::usecase
    TrackSets([Ghi set, reps, weight, RIR]):::usecase
    UseRestTimer([Dùng rest timer]):::usecase
    DetectPR([Phát hiện PR tự động]):::usecase
    FinishWorkout([Hoàn tất và lưu workout log]):::usecase
    ViewWorkoutHistory([Xem lịch sử workout]):::usecase
    ViewWorkoutLogDetail([Xem chi tiết workout log]):::usecase
    DeleteWorkoutLog([Xóa workout log]):::usecase
    ExportOwnLogs([Xuất workout logs của bản thân]):::usecase
    TrackWeight([Ghi cân nặng]):::usecase
    ViewAnalytics([Xem analytics volume, frequency, 1RM]):::usecase
    ViewCalendar([Xem calendar và year view]):::usecase
    ReceiveCoachFeedback([Xem nhận xét của coach]):::usecase
  end

  Trainee --> ViewDashboard
  Trainee --> ViewSchedule
  Trainee --> BrowseExercise
  Trainee --> ManagePersonalWorkout
  Trainee --> ViewAssignedProgram
  Trainee --> StartWorkout
  Trainee --> ViewWorkoutHistory
  Trainee --> ViewWorkoutLogDetail
  Trainee --> DeleteWorkoutLog
  Trainee --> ExportOwnLogs
  Trainee --> TrackWeight
  Trainee --> ViewAnalytics
  Trainee --> ViewCalendar
  Trainee --> ReceiveCoachFeedback
  Coach -. tạo gán .-> ViewAssignedProgram

  StartWorkout -. include .-> TrackSets
  StartWorkout -. extend .-> UseRestTimer
  TrackSets -. extend .-> DetectPR
  StartWorkout -. include .-> FinishWorkout
  FinishWorkout --> DB
  ManagePersonalWorkout --> DB
  ViewAssignedProgram --> DB
  ViewWorkoutHistory --> DB
  TrackWeight --> DB
  ViewAnalytics --> DB
  ViewCalendar --> DB
  ExportOwnLogs --> N8N

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 4. Trainee - nutrition và tìm coach

```mermaid
flowchart LR
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  DB["PostgreSQL"]:::external
  USDA["USDA FoodData Central"]:::external

  subgraph SYS["Nutrition & Coach Discovery"]
    ViewNutritionDay([Xem log dinh dưỡng theo ngày]):::usecase
    SearchFoods([Tìm food trong database]):::usecase
    CreateFood([Tạo food cá nhân]):::usecase
    AddMealItem([Thêm món vào bữa ăn]):::usecase
    DeleteMealItem([Xóa món khỏi bữa ăn]):::usecase
    CalculateMacros([Tính calories và macro còn lại]):::usecase
    SetNutritionTargets([Cập nhật calorie, protein, carb, fat target]):::usecase
    DiscoverCoaches([Tìm coach đang hoạt động]):::usecase
    RequestCoach([Gửi yêu cầu kết nối coach]):::usecase
    ViewCoachRequestStatus([Theo dõi trạng thái yêu cầu]):::usecase
    LinkCoachTrainee([Thiết lập quan hệ coach - trainee]):::usecase
  end

  Trainee --> ViewNutritionDay
  Trainee --> SearchFoods
  Trainee --> CreateFood
  Trainee --> AddMealItem
  Trainee --> DeleteMealItem
  Trainee --> SetNutritionTargets
  Trainee --> DiscoverCoaches
  Trainee --> RequestCoach
  Trainee --> ViewCoachRequestStatus
  Coach -. approve reject .-> LinkCoachTrainee

  ViewNutritionDay -. include .-> CalculateMacros
  AddMealItem -. include .-> SearchFoods
  SearchFoods -. extend .-> USDA
  ViewNutritionDay --> DB
  CreateFood --> DB
  AddMealItem --> DB
  DeleteMealItem --> DB
  SetNutritionTargets --> DB
  DiscoverCoaches --> DB
  RequestCoach --> DB
  LinkCoachTrainee --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 5. Coach - coaching, giáo án và trainee management

```mermaid
flowchart LR
  Coach["Coach"]:::actor
  Trainee["Trainee"]:::actor
  Admin["Admin"]:::actor
  DB["PostgreSQL"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph SYS["Coach Workspace"]
    CoachDashboard([Xem coach dashboard và nav counts]):::usecase
    ListTrainees([Xem và tìm trainee]):::usecase
    ViewTraineeDetail([Xem chi tiết trainee]):::usecase
    ViewTraineeLogs([Xem workout logs của trainee]):::usecase
    ExportTraineeLogs([Xuất workout logs của trainee]):::usecase
    CommentWorkoutLog([Thêm, sửa, xóa nhận xét workout log]):::usecase
    RecordBodyMetrics([Ghi body metrics cho trainee]):::usecase
    CreateCheckIn([Tạo structured check-in]):::usecase
    ManagePrograms([Quản lý giáo án]):::usecase
    BuildProgram([Tạo/sửa giáo án gồm workout, exercise, set]):::usecase
    ArchiveProgram([Archive/restore/delete giáo án]):::usecase
    AssignProgram([Gán hoặc hủy gán giáo án]):::usecase
    AdjustProgram([Điều chỉnh giáo án riêng cho trainee]):::usecase
    ManageCoachExercises([Quản lý bài tập của coach]):::usecase
    SubmitExerciseImport([Gửi yêu cầu import exercise]):::usecase
    ReviewCoachRequests([Duyệt hoặc từ chối yêu cầu coach]):::usecase
    CreateNotifications([Tạo thông báo liên quan coaching]):::usecase
  end

  Coach --> CoachDashboard
  Coach --> ListTrainees
  Coach --> ViewTraineeDetail
  Coach --> ViewTraineeLogs
  Coach --> ExportTraineeLogs
  Coach --> CommentWorkoutLog
  Coach --> RecordBodyMetrics
  Coach --> CreateCheckIn
  Coach --> ManagePrograms
  Coach --> ManageCoachExercises
  Coach --> SubmitExerciseImport
  Coach --> ReviewCoachRequests
  Trainee -. gửi request và log workout .-> ReviewCoachRequests
  Admin -. quản trị kết nối .-> ListTrainees

  ManagePrograms -. include .-> BuildProgram
  ManagePrograms -. extend .-> ArchiveProgram
  ManagePrograms -. extend .-> AssignProgram
  ManagePrograms -. extend .-> AdjustProgram
  AssignProgram -. include .-> CreateNotifications
  CommentWorkoutLog -. include .-> CreateNotifications
  ReviewCoachRequests -. include .-> CreateNotifications

  CoachDashboard --> DB
  ListTrainees --> DB
  ViewTraineeDetail --> DB
  ViewTraineeLogs --> DB
  CommentWorkoutLog --> DB
  RecordBodyMetrics --> DB
  CreateCheckIn --> DB
  ManagePrograms --> DB
  ManageCoachExercises --> DB
  SubmitExerciseImport --> DB
  ReviewCoachRequests --> DB
  ExportTraineeLogs --> N8N

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 6. Admin - vận hành nền tảng

```mermaid
flowchart LR
  Admin["Admin"]:::actor
  Coach["Coach"]:::actor
  Trainee["Trainee"]:::actor
  SupabaseAuth["Supabase Auth"]:::external
  DB["PostgreSQL"]:::external

  subgraph SYS["Admin Console"]
    AdminDashboard([Xem platform dashboard]):::usecase
    ListUsers([Tìm kiếm và xem user]):::usecase
    UpdateUser([Cập nhật role hoặc trạng thái active]):::usecase
    ResetUserPassword([Reset password cho user]):::usecase
    ManageConnections([Quản lý kết nối coach - trainee]):::usecase
    AssignCoach([Gán coach cho trainee]):::usecase
    RemoveCoach([Gỡ coach khỏi trainee]):::usecase
    ModerateCoachRequests([Duyệt, từ chối, xóa coach request]):::usecase
    ReviewPrograms([Xem và xóa program]):::usecase
    CurateExerciseLibrary([Quản trị thư viện bài tập]):::usecase
    CRUDExercise([Tạo, sửa, xóa exercise và variation]):::usecase
    ImportExercises([Import exercise hàng loạt]):::usecase
    SyncExercises([Preview/apply exercise sync]):::usecase
    BulkDeleteExercises([Bulk delete exercise]):::usecase
    DeleteExerciseGroup([Xóa nhóm muscle group]):::usecase
    ReviewExerciseImports([Duyệt yêu cầu import từ coach]):::usecase
    ViewAuditLogs([Xem audit logs]):::usecase
    WriteAuditLog([Ghi admin audit log]):::usecase
  end

  Admin --> AdminDashboard
  Admin --> ListUsers
  Admin --> UpdateUser
  Admin --> ResetUserPassword
  Admin --> ManageConnections
  Admin --> ModerateCoachRequests
  Admin --> ReviewPrograms
  Admin --> CurateExerciseLibrary
  Admin --> ViewAuditLogs
  Coach -. gửi import request .-> ReviewExerciseImports
  Coach -. liên quan kết nối .-> ManageConnections
  Trainee -. liên quan kết nối .-> ManageConnections

  ManageConnections -. extend .-> AssignCoach
  ManageConnections -. extend .-> RemoveCoach
  CurateExerciseLibrary -. include .-> CRUDExercise
  CurateExerciseLibrary -. extend .-> ImportExercises
  CurateExerciseLibrary -. extend .-> SyncExercises
  CurateExerciseLibrary -. extend .-> BulkDeleteExercises
  CurateExerciseLibrary -. extend .-> DeleteExerciseGroup
  CurateExerciseLibrary -. extend .-> ReviewExerciseImports
  UpdateUser -. include .-> WriteAuditLog
  ManageConnections -. include .-> WriteAuditLog
  ModerateCoachRequests -. include .-> WriteAuditLog
  CurateExerciseLibrary -. include .-> WriteAuditLog
  ReviewPrograms -. include .-> WriteAuditLog
  ResetUserPassword --> SupabaseAuth

  AdminDashboard --> DB
  ListUsers --> DB
  UpdateUser --> DB
  ManageConnections --> DB
  ModerateCoachRequests --> DB
  ReviewPrograms --> DB
  CurateExerciseLibrary --> DB
  ViewAuditLogs --> DB
  WriteAuditLog --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 7. AI assistant và tích hợp ngoài

```mermaid
flowchart LR
  User["Người dùng đã đăng nhập"]:::actor
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  AIProvider["OpenAI / Anthropic provider"]:::external
  DB["PostgreSQL"]:::external
  N8N["n8n webhook"]:::external
  GoogleSheets["Google Sheets"]:::external

  subgraph SYS["AI & Integrations"]
    ChatAI([Chat với AI fitness assistant]):::usecase
    GenerateProgram([Generate workout program]):::usecase
    PreviewProgram([Xem preview giáo án AI]):::usecase
    AcceptProgram([Accept AI program]):::usecase
    PersistAIGeneration([Lưu AIGeneration, input, output, token usage]):::usecase
    CreateProgramFromAI([Tạo Program/Workout/ExerciseSet từ output AI]):::usecase
    GenerateMealPlan([Generate meal plan]):::usecase
    PreviewMealPlan([Xem preview meal plan]):::usecase
    AcceptMealPlan([Accept meal plan vào ngày cụ thể]):::usecase
    CreateMealsFromAI([Tạo Meal và MealFoodItem từ output AI]):::usecase
    ExportOwnWorkoutLogs([Trainee export workout logs]):::usecase
    ExportCoachWorkoutLogs([Coach export trainee workout logs]):::usecase
  end

  User --> ChatAI
  User --> GenerateProgram
  User --> GenerateMealPlan
  Trainee --> AcceptMealPlan
  Trainee --> ExportOwnWorkoutLogs
  Coach --> AcceptProgram
  Coach --> ExportCoachWorkoutLogs

  ChatAI --> AIProvider
  GenerateProgram --> AIProvider
  GenerateMealPlan --> AIProvider
  ChatAI -. include .-> PersistAIGeneration
  GenerateProgram -. include .-> PersistAIGeneration
  GenerateMealPlan -. include .-> PersistAIGeneration
  GenerateProgram -. include .-> PreviewProgram
  GenerateMealPlan -. include .-> PreviewMealPlan
  AcceptProgram -. include .-> CreateProgramFromAI
  AcceptMealPlan -. include .-> CreateMealsFromAI
  PersistAIGeneration --> DB
  CreateProgramFromAI --> DB
  CreateMealsFromAI --> DB
  ExportOwnWorkoutLogs --> N8N
  ExportCoachWorkoutLogs --> N8N
  N8N --> GoogleSheets

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 8. Notification và reminder

```mermaid
flowchart LR
  User["Người dùng đã đăng nhập"]:::actor
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  SystemEvent["Sự kiện hệ thống"]:::external
  DB["PostgreSQL"]:::external

  subgraph SYS["Notifications"]
    CreateWorkoutReminder([Tạo workout reminder]):::usecase
    CreateMealReminder([Tạo meal reminder]):::usecase
    CreateCheckInReminder([Tạo check-in reminder]):::usecase
    NotifyProgramAssigned([Thông báo program assigned]):::usecase
    NotifyCoachRequest([Thông báo coach request]):::usecase
    NotifyWorkoutLogged([Thông báo workout logged]):::usecase
    NotifyGeneral([Thông báo general]):::usecase
    ListNotifications([Xem danh sách thông báo]):::usecase
    MarkRead([Đánh dấu một thông báo đã đọc]):::usecase
    MarkAllRead([Đánh dấu tất cả đã đọc]):::usecase
    ShowUnreadCounts([Hiển thị số lượng chưa đọc]):::usecase
  end

  SystemEvent --> CreateWorkoutReminder
  SystemEvent --> CreateMealReminder
  SystemEvent --> CreateCheckInReminder
  SystemEvent --> NotifyProgramAssigned
  SystemEvent --> NotifyCoachRequest
  SystemEvent --> NotifyWorkoutLogged
  SystemEvent --> NotifyGeneral
  User --> ListNotifications
  User --> MarkRead
  User --> MarkAllRead
  User --> ShowUnreadCounts
  Trainee -. nhận .-> NotifyProgramAssigned
  Coach -. nhận .-> NotifyCoachRequest
  Coach -. nhận .-> NotifyWorkoutLogged

  CreateWorkoutReminder --> DB
  CreateMealReminder --> DB
  CreateCheckInReminder --> DB
  NotifyProgramAssigned --> DB
  NotifyCoachRequest --> DB
  NotifyWorkoutLogged --> DB
  NotifyGeneral --> DB
  ListNotifications --> DB
  MarkRead --> DB
  MarkAllRead --> DB
  ShowUnreadCounts --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```
