# Sơ đồ AI — Fitness App

Mở [trang tổng hợp](index.html). Phản ánh mã nguồn được kiểm tra ngày 08/09/2026; không phải bằng chứng chạy tích hợp với model thật.

## Danh mục

| Sơ đồ | API | Nguồn chính |
|---|---|---|
| [Use case tổng thể](usecase-ai.html) | 5 endpoint AI | `backend/src/routes/ai.route.ts:15–67` |
| [Tạo chương trình](sequence-workout.html) | POST `/api/ai/generate-program` | `backend/src/services/ai.service.ts:212` |
| [Lưu chương trình](sequence-workout-accept.html) | POST `/api/ai/accept-program` | `backend/src/services/ai.service.ts:449` |
| [Tạo thực đơn](sequence-meals.html) | POST `/api/ai/generate-meal-plan` | `backend/src/services/ai.service.ts:638` |
| [Ghi nhận thực đơn](sequence-meals-accept.html) | POST `/api/ai/accept-meal-plan` | `backend/src/services/ai.service.ts:842` |
| [Chat cá nhân hóa](sequence-chat.html) | POST `/api/ai/chat` | `backend/src/services/ai.service.ts:1070` |

## Quy ước và phạm vi

- Sequence do Archify dựng từ JSON; ghép người dùng/giao diện thành một lifeline và route/service/provider adapter thành lifeline API để dễ đọc. Các bước kiểm tra, ghép dữ liệu thuộc API, không phải database tự thực hiện. Xác thực được rút gọn; triển khai gọi `requireCurrentProfile`, bao gồm dịch vụ xác thực và đọc profile.
- Luồng phản hồi dùng envelope `{ data, error, meta }`; sơ đồ ghi payload nghiệp vụ và HTTP status. Request trình duyệt đi qua lớp API/proxy của frontend.
- Use case là UML SVG/HTML viết riêng, kèm nguồn [PlantUML](usecase-ai.puml), vì Archify không có schema use case. Không gắn nhãn “Archify validated” cho SVG này.
- Actor chính là người dùng đã đăng nhập: API AI không chặn riêng theo role. Chat bubble chỉ được render cho trainee tại `app/(shell)/layout.tsx`. Không suy diễn rằng coach/admin có giao diện giống trainee.
- Hai use case lưu có tiền điều kiện: generation thuộc người dùng và `completed`. Không dùng `include`/`extend` để diễn tả thứ tự tạo rồi lưu; xác nhận lưu là request độc lập và không gọi lại model.
- Provider là Anthropic hoặc API tương thích OpenAI theo `backend/src/lib/ai/ai-client.ts`; không khẳng định provider/model nào đang chạy thực tế.
- Nội dung tiếng Việt. UI cố định và thuộc tính `<html lang>` của viewer Archify dùng tiếng Anh theo giới hạn của skill.

## Nhánh lỗi và giới hạn cần đọc cùng sequence

| Luồng | Hành vi thực tế |
|---|---|
| Chung | Xác thực lỗi được route trả qua `sendApiError`. Timeout AI mặc định 60 giây. |
| Tạo chương trình | Quota 5 lần/ngày. Input chỉ kiểm tra một phần. Catalog gồm bài hệ thống và bài của user; lịch sử chỉ đưa số buổi trong tối đa 20 log/30 ngày vào prompt. AI được yêu cầu tạo tuần đầu. Ghép bài dưới 70% → `failed`, 422. Lỗi provider/parse thông thường → `failed`, 500. |
| Lưu chương trình | Không tìm thấy/khác chủ sở hữu → 404; trạng thái không completed → 400. Transaction tạo Program, Assignment, Workout, WorkoutExercise, ExerciseSet rồi accepted. Kiểm tra trạng thái nằm ngoài transaction nên chưa chống xác nhận đồng thời đầy đủ. |
| Tạo thực đơn | Quota 10 lần/ngày. Prompt yêu cầu 4 bữa, chưa kiểm tra chặt số bữa bằng code. Món không khớp bị bỏ; chưa có ngưỡng tỷ lệ ghép. Tổng preview lấy từ AI, chưa tính lại theo khẩu phần. Lỗi provider/parse thông thường → failed, 500. |
| Ghi nhận thực đơn | Gọi `addMealItemForUser` cho từng món, tính dinh dưỡng qua nutrition service. Lỗi từng món bị bắt và bỏ qua; sau vòng lặp vẫn accepted=true. Không có transaction toàn bộ thực đơn; dữ liệu được thêm trực tiếp vào nhật ký ăn uống. |
| Chat | Câu hỏi không rỗng, tối đa 2.000 ký tự. 40 tin/ngày/user trong RAM, mất sau restart. Lỗi đọc ngữ cảnh bị bỏ qua, tiếp tục gọi AI với profile. Dùng tối đa 6 tin lịch sử gần nhất. Không ghi AIGeneration hoặc lưu hội thoại vào DB; frontend giữ state. Lỗi API được UI đổi thành lời xin lỗi chung. |

Ngữ cảnh chat tại `ai.service.ts:910` đọc cân nặng, bữa ăn, log trong tuần và sets. Không nên hiểu hình này là xác nhận chất lượng phép tính tiến độ: code hiện đọc ExerciseSet kèm ngày log mới nhất và truy vấn bữa ăn hôm nay thiếu cận trên.

## Nguồn và kiểm tra

- `build-specs.cjs`: tạo 5 JSON sequence và ghi chú. `build-usecase.cjs`: tạo SVG/HTML/PlantUML và trang tổng hợp.
- `*.validate.json`: kiểm tra schema và hình học. `*.deliver.json`: receipt 9/9 showcase, SHA-256 và kích thước nguồn/artifact.
- `*.browser.json`, `*.visual-check.json`: kiểm tra browser cho đúng HTML đã deliver; bốn viewport 1440×900, 1600×1000, 1920×1080, 2048×1320; ảnh light/dark ở hai kích thước đầu/cuối.
- `handoff.json`: bảng tổng hợp receipt và phạm vi kiểm tra trực quan. `usecase-ai.png`: ảnh chụp UML trong Chrome ở 1440×900.
- Không chỉnh HTML sequence sau `deliver`. Nếu sửa JSON, cần validate → deliver → visual-check lại.
