# ERD toàn hệ thống YeahBuddy

Mở `index.html` để xem ERD, đổi nhóm chức năng, tìm bảng và xem từ điển cột. File này chứa SVG và dữ liệu schema nội tuyến, không cần CDN. `overview.html` là sơ đồ tổng quan nhóm dữ liệu do Archify tạo; không phải ERD cấp cột.

Sơ đồ lớp UML bổ sung tại `../uml-class-diagram/class-diagram.html`, dùng để xem các lớp dịch vụ, thuộc tính và phương thức chính của toàn hệ thống.

## Nguồn và phạm vi

- Schema: `schema.snapshot.prisma`, lấy từ `backend/prisma/schema.prisma` của worktree `complete-ai-validation`, revision `1134c533f7f92cb7a667f051cf62b859d985ab9c` (bản đã kiểm thử của PR #84).
- Checkout chính có schema cũ hơn; không dùng nó để bỏ sót `MuscleRegion` và `VariationMuscleTarget`.
- Bao phủ **22 bảng, 249 cột scalar/enum, 32 FK, 20 enum**, một PK ghép và các unique ghép. Số cột không tính navigation/relation fields ảo của Prisma.
- Đây là ERD theo mã nguồn, không phải introspection production. Không đọc dữ liệu tài khoản và không thay đổi database.

## Các file chính

| File | Nội dung |
|---|---|
| `index.html` | Trang ERD chi tiết, 8 góc nhìn, tìm bảng, phóng to/di chuyển và tải SVG |
| `all.svg` / `all.png` | Toàn bộ 22 bảng, tập trung PK/FK/unique |
| `columns.svg` | Toàn bộ 22 bảng và đủ 249 cột; dùng zoom khi đọc |
| `library.svg` | Exercise, Variation, MuscleRegion, VariationMuscleTarget |
| `planning.svg` | Program, ProgramAssignment, Workout, WorkoutExercise, ExerciseSet |
| `history.svg` | WorkoutLog, WorkoutLogComment và bảng liên quan |
| `nutrition.svg` | Food, Meal, MealFoodItem |
| `coaching.svg` | CoachRequest, CoachCheckIn, BodyMetricEntry |
| `operations.svg` | AIGeneration, Notification, AdminAuditLog, ExerciseImportRequest |
| `data-dictionary.md` | Đầy đủ cột, kiểu, nullable, default, khóa, chỉ mục và enum; đọc được không cần JavaScript |
| `full-erd.mmd` | Nguồn Mermaid erDiagram, quan hệ vật lý |
| `overview.html` | Tổng quan nhóm dữ liệu bằng Archify, kiểu architecture |
| `overview.deliver.json` | Biên nhận Archify và SHA-256 nguồn/HTML |
| `coverage.json` | Kiểm tra độ bao phủ schema của ERD |

Các góc nhìn nhóm lặp lại bảng liên quan như `User` dưới dạng rút gọn để đọc quan hệ; không tạo thêm bảng thật. Chế độ “mọi cột” và từ điển dữ liệu là nguồn đầy đủ thuộc tính. Nội dung tự viết bằng tiếng Việt; Viewer UI và html lang của Archify giữ fallback tiếng Anh.

## Quy ước quan hệ

- `PK`, `FK`, `UK`: khóa chính, khóa ngoại, unique đơn cột; unique/PK ghép ghi ở cuối thẻ bảng và trong từ điển.
- `?`: cột nullable. Cha bắt buộc là `1`; cha tùy chọn là `0..1`; một cha có `0..N` con. FK không unique nên không suy diễn thành quan hệ 1–1.
- `User.coachId → User.id`: quan hệ tự tham chiếu coach/trainee, nullable, SetNull khi xóa coach.
- `WorkoutLog.programId`, `AIGeneration.programId`: nét đứt màu vàng, tham chiếu logic, **không có FK Prisma**.
- `User.supabaseAuthUserId`: unique nullable, không khai báo FK đến `auth.users` trong schema. Không tự thêm bảng Auth/Storage nội bộ của Supabase vào ERD ứng dụng.
- `Notification.relatedEntityId`, `AdminAuditLog.entityId`: tham chiếu đa hình, không vẽ FK giả.
- JSON snapshot, metadata và AI input/output là cột JSON; không suy diễn thành bảng hoặc FK.

## Kiểm chứng

- Archify `architecture`: **9/9 showcase**, 0 lỗi, 0 cảnh báo; automated browser evidence **passed** tại 1440×900, 1600×1000, 1920×1080, 2048×1320; ảnh light/dark nằm cùng thư mục.
- Đã xem ảnh Archify và các PNG ERD để kiểm tra chữ, cột, hướng kết nối; sửa đường tự tham chiếu để đi ngoài bảng. ERD đầy đủ cần zoom hoặc các góc nhìn nhóm vì có nhiều quan hệ cùng trỏ về User.
- Client Prisma sinh ra khớp schema nguồn (bỏ khác biệt khoảng trắng). Kiểm tra có đủ 22 entity / 249 field / 32 FK trong SVG đầy đủ; JavaScript của trang chi tiết parse được.
- **Chưa xác nhận tương tác trình duyệt của `index.html`:** công cụ trình duyệt chặn URL file local. Không dùng cách vòng qua chặn. Review ảnh SVG/PNG không được coi là kiểm thử DOM, nút tìm kiếm, zoom hoặc tải file.
- Kiểm tra Archify chỉ áp dụng cho `overview.html`; không gán chứng nhận showcase đó cho ERD Graphviz tùy biến.

## Tái tạo

`build-erd.cjs` đọc Prisma DMMF và schema, tạo 8 SVG/DOT, Mermaid, metadata và HTML. Cần Prisma Client đã generate đúng schema cùng `@viz-js/viz@3.30.0` tại `.pr-worktrees/erd-tools/node_modules`. Không có dependency mới trong package.json của ứng dụng. Truyền đường dẫn checkout nguồn làm đối số nếu không dùng worktree mặc định.

```powershell
node docs/erd-system/build-erd.cjs D:/Source_code/fitness-app/.pr-worktrees/complete-ai-validation
```

Giữ nguyên file Archify sau delivery; nếu sửa `overview.architecture.json`, chạy lại validate, deliver và visual-check trước khi dùng biên nhận cũ.
