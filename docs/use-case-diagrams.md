# Use Case Diagrams - YeahBuddy Fitness

Tài liệu này dùng 6 use case chính làm source of truth cho hệ thống YeahBuddy Fitness. Các chức năng như profile, avatar, resume workout, notification, AI, export và exercise import là luồng phụ hoặc supporting flow, không tách thành use case chính độc lập.

Nguồn đối chiếu: `README.md`, `backend/prisma/schema.prisma`, `backend/src/routes/*`, `lib/*/api.ts`.

Ghi chú: Mermaid không có cú pháp UML use case native ổn định trên mọi viewer, nên tài liệu dùng `flowchart LR` với use case dạng oval và actor dạng node riêng.

Quy ước đọc sơ đồ:

- Đường liền: actor trực tiếp thực hiện use case.
- Đường chấm `include`: use case chính luôn gọi thêm luồng con.
- Đường chấm `extend`: luồng mở rộng tùy điều kiện.
- Node màu xám: hệ thống/tích hợp bên ngoài.

## 1. Tổng quan 6 use case chính

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
  LocalStorage["Browser localStorage"]:::external
  AIProvider["OpenAI / Anthropic provider"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph SYS["YeahBuddy Fitness"]
    UC01([UC-01: Đăng ký tài khoản]):::usecase
    UC02([UC-02: Đăng nhập]):::usecase
    UC03([UC-03: Trainee thực hiện và ghi log buổi tập]):::usecase
    UC04([UC-04: Trainee ghi nhận dinh dưỡng và theo dõi tiến độ]):::usecase
    UC05([UC-05: Coach quản lý giáo án và trainee]):::usecase
    UC06([UC-06: Admin quản trị hệ thống]):::usecase
  end

  Visitor --> UC01
  Visitor --> UC02
  User --> UC02
  Trainee --> UC03
  Trainee --> UC04
  Trainee -. gửi coach request .-> UC05
  Coach --> UC05
  Admin --> UC06

  UC01 --> SupabaseAuth
  UC01 --> Postgres
  UC02 --> SupabaseAuth
  UC02 --> SupabaseStorage
  UC02 --> Postgres
  UC03 --> Postgres
  UC03 --> LocalStorage
  UC03 -. export .-> N8N
  UC04 --> Postgres
  UC04 -. AI meal plan .-> AIProvider
  UC05 --> Postgres
  UC05 -. AI program .-> AIProvider
  UC05 -. export .-> N8N
  UC06 --> Postgres
  UC06 --> SupabaseAuth

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 2. UC-01 - Đăng ký tài khoản

```mermaid
flowchart LR
  Visitor["Khách truy cập"]:::actor
  SupabaseAuth["Supabase Auth"]:::external
  DB["PostgreSQL"]:::external

  subgraph UC01["UC-01: Đăng ký tài khoản"]
    SubmitRegister([Nhập name, email, username, phone, password, role]):::usecase
    ValidateRegister([Validate dữ liệu đăng ký]):::usecase
    CreateAuthUser([Tạo Supabase auth user]):::usecase
    CreateLocalProfile([Tạo local User profile]):::usecase
    EmailConfirmation([Chờ xác nhận email]):::usecase
    RedirectByRole([Điều hướng theo role sau khi có session]):::usecase
  end

  Visitor --> SubmitRegister
  SubmitRegister -. include .-> ValidateRegister
  ValidateRegister -. include .-> CreateAuthUser
  CreateAuthUser --> SupabaseAuth
  CreateAuthUser -. include .-> CreateLocalProfile
  CreateLocalProfile --> DB
  CreateAuthUser -. extend .-> EmailConfirmation
  CreateLocalProfile -. include .-> RedirectByRole

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 3. UC-02 - Đăng nhập

```mermaid
flowchart LR
  Visitor["Khách truy cập"]:::actor
  User["Người dùng đã đăng nhập"]:::actor
  SupabaseAuth["Supabase Auth"]:::external
  Storage["Supabase Storage"]:::external
  DB["PostgreSQL"]:::external

  subgraph UC02["UC-02: Đăng nhập"]
    Login([Đăng nhập bằng email, username hoặc phone]):::usecase
    OAuthCallback([Xử lý OAuth / email callback]):::usecase
    SyncProfile([Đồng bộ Supabase user sang User profile]):::usecase
    AuthorizeRoute([Kiểm tra session và phân quyền role]):::usecase
    LoadDashboard([Tải dashboard theo role]):::usecase
    UpdateProfile([Cập nhật hồ sơ, mục tiêu và đơn vị cân nặng]):::usecase
    UploadAvatar([Upload avatar]):::usecase
    RefreshSession([Refresh session]):::usecase
    ForgotPassword([Gửi email khôi phục mật khẩu]):::usecase
    Logout([Đăng xuất]):::usecase
  end

  Visitor --> Login
  Visitor --> OAuthCallback
  Visitor --> ForgotPassword
  User --> RefreshSession
  User --> AuthorizeRoute
  User --> UpdateProfile
  User --> UploadAvatar
  User --> Logout

  Login -. include .-> SupabaseAuth
  OAuthCallback -. include .-> SupabaseAuth
  ForgotPassword -. include .-> SupabaseAuth
  RefreshSession -. include .-> SupabaseAuth
  Login -. include .-> SyncProfile
  OAuthCallback -. include .-> SyncProfile
  SyncProfile --> DB
  AuthorizeRoute -. include .-> LoadDashboard
  LoadDashboard --> DB
  UpdateProfile --> DB
  UploadAvatar --> Storage
  UploadAvatar --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 4. UC-03 - Trainee thực hiện và ghi log buổi tập

```mermaid
flowchart LR
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  DB["PostgreSQL"]:::external
  LocalStorage["Browser localStorage"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph UC03["UC-03: Trainee thực hiện và ghi log buổi tập"]
    ViewDashboard([Xem trainee dashboard và lịch tập]):::usecase
    BrowseExercise([Tra cứu exercise library]):::usecase
    CreatePersonalWorkout([Tạo, sửa, xóa workout cá nhân]):::usecase
    ViewAssignedProgram([Xem giáo án được coach gán]):::usecase
    StartWorkout([Bắt đầu buổi tập]):::usecase
    TrackSets([Ghi actual reps, weight, RIR và completed sets]):::usecase
    UseRestTimer([Dùng rest timer]):::usecase
    DetectPR([Phát hiện PR tự động]):::usecase
    PersistSession([Lưu tạm workout session đang dở]):::usecase
    ShowResumeCard([Hiển thị floating resume card]):::usecase
    ResumeSession([Tiếp tục workout session đang dở]):::usecase
    DiscardSession([Hủy workout session đang dở]):::usecase
    FinishWorkout([Hoàn tất và lưu workout log]):::usecase
    ViewHistory([Xem history, detail, calendar và year view]):::usecase
    DeleteLog([Xóa workout log]):::usecase
    ExportLogs([Xuất workout logs của bản thân]):::usecase
  end

  Trainee --> ViewDashboard
  Trainee --> BrowseExercise
  Trainee --> CreatePersonalWorkout
  Trainee --> ViewAssignedProgram
  Trainee --> StartWorkout
  Trainee --> ResumeSession
  Trainee --> DiscardSession
  Trainee --> ViewHistory
  Trainee --> DeleteLog
  Trainee --> ExportLogs
  Coach -. tạo và gán .-> ViewAssignedProgram

  StartWorkout -. include .-> TrackSets
  TrackSets -. include .-> PersistSession
  TrackSets -. extend .-> UseRestTimer
  TrackSets -. extend .-> DetectPR
  PersistSession -. enables .-> ShowResumeCard
  ShowResumeCard -. extend .-> ResumeSession
  ShowResumeCard -. extend .-> DiscardSession
  ResumeSession -. include .-> StartWorkout
  StartWorkout -. include .-> FinishWorkout

  ViewDashboard --> DB
  BrowseExercise --> DB
  CreatePersonalWorkout --> DB
  ViewAssignedProgram --> DB
  FinishWorkout --> DB
  ViewHistory --> DB
  DeleteLog --> DB
  PersistSession --> LocalStorage
  ShowResumeCard --> LocalStorage
  ResumeSession --> LocalStorage
  DiscardSession --> LocalStorage
  ExportLogs --> N8N

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 5. UC-04 - Trainee ghi nhận dinh dưỡng và theo dõi tiến độ

```mermaid
flowchart LR
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  DB["PostgreSQL"]:::external
  USDA["USDA FoodData Central"]:::external
  AIProvider["OpenAI / Anthropic provider"]:::external

  subgraph UC04["UC-04: Trainee ghi nhận dinh dưỡng và theo dõi tiến độ"]
    ViewNutritionDay([Xem nutrition day]):::usecase
    SearchFoods([Tìm food trong database]):::usecase
    CreateFood([Tạo food cá nhân]):::usecase
    AddMealItem([Thêm món vào bữa ăn]):::usecase
    DeleteMealItem([Xóa món khỏi bữa ăn]):::usecase
    CalculateMacros([Tính calories, protein, carb, fat còn lại]):::usecase
    UpdateNutritionTargets([Cập nhật nutrition targets trong profile]):::usecase
    GenerateMealPlan([Generate meal plan bằng AI]):::usecase
    AcceptMealPlan([Accept meal plan vào meal log]):::usecase
    TrackWeight([Ghi cân nặng và body metrics]):::usecase
    ViewProgressAnalytics([Xem volume, frequency, strength và 1RM analytics]):::usecase
    ViewCalendar([Xem progress calendar và year view]):::usecase
  end

  Trainee --> ViewNutritionDay
  Trainee --> SearchFoods
  Trainee --> CreateFood
  Trainee --> AddMealItem
  Trainee --> DeleteMealItem
  Trainee --> UpdateNutritionTargets
  Trainee --> GenerateMealPlan
  Trainee --> AcceptMealPlan
  Trainee --> TrackWeight
  Trainee --> ViewProgressAnalytics
  Trainee --> ViewCalendar
  Coach -. xem summary của trainee .-> ViewProgressAnalytics

  ViewNutritionDay -. include .-> CalculateMacros
  AddMealItem -. include .-> SearchFoods
  SearchFoods -. extend .-> USDA
  GenerateMealPlan -. extend .-> AIProvider
  AcceptMealPlan -. include .-> AddMealItem

  ViewNutritionDay --> DB
  SearchFoods --> DB
  CreateFood --> DB
  AddMealItem --> DB
  DeleteMealItem --> DB
  UpdateNutritionTargets --> DB
  AcceptMealPlan --> DB
  TrackWeight --> DB
  ViewProgressAnalytics --> DB
  ViewCalendar --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 6. UC-05 - Coach quản lý giáo án và trainee

```mermaid
flowchart LR
  Trainee["Trainee"]:::actor
  Coach["Coach"]:::actor
  Admin["Admin"]:::actor
  DB["PostgreSQL"]:::external
  AIProvider["OpenAI / Anthropic provider"]:::external
  N8N["n8n / Google Sheets"]:::external

  subgraph UC05["UC-05: Coach quản lý giáo án và trainee"]
    DiscoverCoach([Trainee tìm coach đang hoạt động]):::usecase
    RequestCoach([Trainee gửi coach request]):::usecase
    ReviewCoachRequest([Coach duyệt hoặc từ chối request]):::usecase
    CoachDashboard([Xem coach dashboard và nav counts]):::usecase
    ListTrainees([Xem, tìm và mở chi tiết trainee]):::usecase
    ManageProgram([Tạo, sửa, archive, restore, delete giáo án]):::usecase
    AssignProgram([Gán hoặc hủy gán giáo án cho trainee]):::usecase
    AdjustProgram([Điều chỉnh giáo án riêng cho trainee]):::usecase
    GenerateProgramAI([Generate program bằng AI]):::usecase
    AcceptProgramAI([Accept AI program thành program thật]):::usecase
    MonitorLogs([Xem workout logs, body metrics và nutrition summary]):::usecase
    CommentLog([Thêm, sửa, xóa nhận xét workout log]):::usecase
    RecordMetric([Ghi body metrics cho trainee]):::usecase
    CreateCheckIn([Tạo structured check-in]):::usecase
    ExportLogs([Export workout logs sang Google Sheets]):::usecase
    ManageCoachExercises([Quản lý exercise riêng của coach]):::usecase
    SubmitExerciseImport([Gửi exercise import request cho admin duyệt]):::usecase
    CreateCoachingNotification([Tạo thông báo liên quan coaching]):::usecase
  end

  Trainee --> DiscoverCoach
  Trainee --> RequestCoach
  Coach --> ReviewCoachRequest
  Coach --> CoachDashboard
  Coach --> ListTrainees
  Coach --> ManageProgram
  Coach --> AssignProgram
  Coach --> AdjustProgram
  Coach --> GenerateProgramAI
  Coach --> MonitorLogs
  Coach --> CommentLog
  Coach --> RecordMetric
  Coach --> CreateCheckIn
  Coach --> ExportLogs
  Coach --> ManageCoachExercises
  Coach --> SubmitExerciseImport
  Admin -. quản trị kết nối/import .-> ReviewCoachRequest

  RequestCoach -. include .-> CreateCoachingNotification
  ReviewCoachRequest -. include .-> CreateCoachingNotification
  AssignProgram -. include .-> CreateCoachingNotification
  CommentLog -. include .-> CreateCoachingNotification
  GenerateProgramAI -. extend .-> AIProvider
  GenerateProgramAI -. include .-> AcceptProgramAI
  AcceptProgramAI -. include .-> ManageProgram

  DiscoverCoach --> DB
  RequestCoach --> DB
  ReviewCoachRequest --> DB
  CoachDashboard --> DB
  ListTrainees --> DB
  ManageProgram --> DB
  AssignProgram --> DB
  AdjustProgram --> DB
  AcceptProgramAI --> DB
  MonitorLogs --> DB
  CommentLog --> DB
  RecordMetric --> DB
  CreateCheckIn --> DB
  ManageCoachExercises --> DB
  SubmitExerciseImport --> DB
  CreateCoachingNotification --> DB
  ExportLogs --> N8N

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 7. UC-06 - Admin quản trị hệ thống

```mermaid
flowchart LR
  Admin["Admin"]:::actor
  Coach["Coach"]:::actor
  Trainee["Trainee"]:::actor
  SupabaseAuth["Supabase Auth"]:::external
  DB["PostgreSQL"]:::external

  subgraph UC06["UC-06: Admin quản trị hệ thống"]
    AdminDashboard([Xem platform dashboard]):::usecase
    ManageUsers([Tìm kiếm, xem chi tiết và cập nhật user]):::usecase
    ResetUserPassword([Reset password cho user]):::usecase
    ManageConnections([Quản lý kết nối coach - trainee]):::usecase
    ModerateCoachRequests([Duyệt, từ chối, xóa coach request]):::usecase
    ReviewPrograms([Xem và xóa program]):::usecase
    ManageExercises([CRUD exercise và variation]):::usecase
    ImportExercises([Import exercise hàng loạt]):::usecase
    SyncExercises([Preview/apply exercise sync]):::usecase
    BulkDeleteExercises([Bulk delete exercise]):::usecase
    DeleteExerciseGroup([Xóa nhóm muscle group]):::usecase
    ReviewExerciseImports([Duyệt exercise import request từ coach]):::usecase
    ViewAuditLogs([Xem audit logs]):::usecase
    WriteAuditLog([Ghi admin audit log]):::usecase
  end

  Admin --> AdminDashboard
  Admin --> ManageUsers
  Admin --> ResetUserPassword
  Admin --> ManageConnections
  Admin --> ModerateCoachRequests
  Admin --> ReviewPrograms
  Admin --> ManageExercises
  Admin --> ImportExercises
  Admin --> SyncExercises
  Admin --> BulkDeleteExercises
  Admin --> DeleteExerciseGroup
  Admin --> ReviewExerciseImports
  Admin --> ViewAuditLogs
  Coach -. gửi import request .-> ReviewExerciseImports
  Coach -. liên quan kết nối .-> ManageConnections
  Trainee -. liên quan kết nối .-> ManageConnections

  ResetUserPassword --> SupabaseAuth
  ManageUsers -. include .-> WriteAuditLog
  ManageConnections -. include .-> WriteAuditLog
  ModerateCoachRequests -. include .-> WriteAuditLog
  ReviewPrograms -. include .-> WriteAuditLog
  ManageExercises -. include .-> WriteAuditLog
  ImportExercises -. include .-> WriteAuditLog
  SyncExercises -. include .-> WriteAuditLog
  BulkDeleteExercises -. include .-> WriteAuditLog
  DeleteExerciseGroup -. include .-> WriteAuditLog
  ReviewExerciseImports -. include .-> WriteAuditLog

  AdminDashboard --> DB
  ManageUsers --> DB
  ManageConnections --> DB
  ModerateCoachRequests --> DB
  ReviewPrograms --> DB
  ManageExercises --> DB
  ImportExercises --> DB
  SyncExercises --> DB
  BulkDeleteExercises --> DB
  DeleteExerciseGroup --> DB
  ReviewExerciseImports --> DB
  ViewAuditLogs --> DB
  WriteAuditLog --> DB

  classDef actor fill:#ffffff,stroke:#111827,stroke-width:1.5px,color:#111827;
  classDef usecase fill:#ecfeff,stroke:#0891b2,stroke-width:1.2px,color:#164e63;
  classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,color:#374151;
```

## 8. Mapping luồng phụ vào 6 UC chính

| Luồng/chức năng | Thuộc UC chính | Ghi chú |
|---|---|---|
| Profile, avatar, refresh session, forgot password, route guard | UC-02 | Là supporting flow sau đăng nhập hoặc trong auth/session. |
| Resume/discard workout session | UC-03 | Là extension của trainee đang thực hiện buổi tập, lưu bằng `localStorage`. |
| Export workout logs của trainee | UC-03 | Là extension sau khi đã có workout logs. |
| AI meal plan | UC-04 | Là extension của meal logging, khi accept sẽ tạo meal log. |
| Trainee tìm coach và gửi request | UC-05 | Là luồng mở đầu quan hệ coaching. |
| Coach request, comment, check-in, export | UC-05 | Là các flow trong quản lý trainee của coach. |
| AI workout program | UC-05 | Là extension của coach tạo giáo án. |
| Exercise import request từ coach | UC-05 -> UC-06 | Coach gửi request, admin review trong UC-06. |
| User/role/connection/audit/exercise import admin | UC-06 | Là các flow quản trị nền tảng. |
| Notification | UC-02/UC-03/UC-05 | Là supporting flow phát sinh từ auth, workout và coaching, không là UC chính riêng. |
