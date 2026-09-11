# Kiểm tra và lưu kế hoạch AI

Triển khai trên `main` sau PR #83. Tài liệu này thay thế các nhận định cũ cho sáu hạng mục dưới đây; không mô tả chức năng chưa triển khai như thể đã có.

## 1. Kiểm tra input và output

- Các API và lời gọi service từ tool chat dùng cùng request schema. Enum mục tiêu, trình độ, thiết bị, ngân sách và thời gian nấu được kiểm tra; số buổi 2–7, số tuần 1–16; thời lượng chương trình 20–180 phút, buổi đơn lẻ 20–120 phút.
- Ngày phải thực sự tồn tại, gồm kiểm tra năm nhuận; không chấp nhận `2026-02-30`. History tối đa 40 phần tử, mỗi phần tử tối đa 4.000 ký tự, câu hỏi tối đa 2.000; prompt chỉ dùng 6 lượt gần nhất sau chuẩn hóa.
- JSON của model được kiểm tra bằng Zod: enum, chuỗi, UUID, số hữu hạn, số nguyên, mảng không rỗng và giới hạn kích thước. Số buổi phải khớp yêu cầu, không trùng ngày, chỉ tuần 0, thời lượng không vượt yêu cầu.
- Sets 1–50, reps 1–1.000, RIR 0–4, nghỉ 0–900 giây, tạ 0–1.000 kg. Thiếu reps có thể dùng repsMin hợp lệ như PR #83; không tự diễn giải chuỗi `8-12` hay `30 giây` thành số lần lặp.
- Thực đơn gồm đủ bốn loại bữa khác nhau; bữa chính 2–3 món, bữa phụ 1–3 món. Khẩu phần phải dương, không quá 5.000; đơn vị chỉ serving/g/ml và phải quy đổi được theo định nghĩa thực phẩm.
- Bản nháp cũ được kiểm tra lại trước khi ghi. Bản cũ không đạt hợp đồng mới phải tạo lại; không âm thầm bỏ bài hoặc món để ép bản nháp hợp lệ.

## 2. Dinh dưỡng dựa trên dữ liệu thực phẩm

- Bản xem trước tính kcal, protein, carbs, fat từ `Food` và khẩu phần qua `calculateItemNutrition`. Không dùng tổng do model tự khai.
- Backend kiểm tra tổng kcal nằm trong ±10% mục tiêu hiện tại. Ngoài khoảng này trả 422, mã `AI_NUTRITION_TARGET_MISMATCH`; không tự thay đổi khẩu phần hay báo đạt mục tiêu.
- Khi xác nhận, đọc lại thực phẩm và tính lại calories trong transaction. Thực phẩm đã bị xóa, không thuộc phạm vi người dùng, thay đổi đơn vị hoặc khiến tổng vượt khoảng mục tiêu sẽ bị từ chối.
- Protein/carbs/fat được tính lại chính xác từ dữ liệu nguồn nhưng chưa có ngưỡng phần trăm bắt buộc riêng; quy tắc ±10% áp dụng cho calories như yêu cầu sinh thực đơn.

## 3. Lưu nguyên tử và chống xử lý lặp

- Cả ba thao tác xác nhận (chương trình, buổi đơn lẻ, thực đơn) kiểm tra chủ sở hữu, loại generation và chế độ daily/program.
- Transaction bắt đầu bằng conditional update theo `id + userId + type + status=completed`. Chỉ request cập nhật được một dòng mới được ghi dữ liệu nghiệp vụ.
- Trạng thái `accepted` chỉ hiển thị ra ngoài khi transaction commit. Lỗi bất kỳ bước nào rollback cả trạng thái và dữ liệu; bản nháp trở lại completed để thử lại.
- Thực đơn truyền cùng Prisma transaction vào `addMealItemForUser`. Không bắt và bỏ qua lỗi từng món; thành công luôn có `skipped: 0`.
- Isolation Serializable và retry P2034 giúp bảo toàn dữ liệu khi hai bản nháp khác nhau cùng thêm vào một ngày. Request xác nhận lại bản đã lưu trả 409, không ghi thêm.
- Không đổi schema, không thêm migration; không gọi model bên trong transaction.

## 4. ID và thiết bị

- Prompt luôn có ID variation, kể cả bài chỉ có một variation. Model trả variationId/foodId; mapper chỉ nhận ID thuộc catalog đã cấp cho request đó.
- Không dùng tên để ghép gần đúng, không chọn variation đầu tiên, không bỏ các phần tử không ghép được. Một bài hoặc món sai làm generation failed và trả thông báo 422 có vị trí/ID liên quan.
- Giới hạn thiết bị được thực thi trong catalog: bodyweight chỉ Bodyweight; home_dumbbells chỉ Bodyweight/Dumbbell. Metadata thiết bị rỗng không được coi là bodyweight. full_gym không giới hạn nhóm thiết bị.
- Lúc lưu chương trình, kiểm tra lại quyền truy cập và thiết bị của mọi variation trong transaction. Bản thành công có mappingRate=100; không còn trường hợp đạt 70% rồi lưu thiếu bài.

## 5. Ngữ cảnh chat và lịch Việt Nam

- Tiến độ lấy `WorkoutLog.exerciseSnapshot` của từng buổi đã hoàn thành, dùng actualReps và các set được đánh dấu completed; không lấy ExerciseSet hiện tại gắn vào ngày log mới nhất.
- Chọn tối đa 80 log gần nhất trong 60 ngày rồi sắp thời gian để so sánh. Bỏ log tương lai/chưa hoàn thành và số lần lặp dự kiến không có actualReps.
- Múi giờ AI thống nhất `Asia/Ho_Chi_Minh`. Date-only trong database vẫn là khóa ngày UTC midnight; cửa sổ timestamp dùng thời điểm UTC tương ứng với 00:00 Việt Nam.
- Ngữ cảnh bữa ăn có cả cận dưới và cận trên, không đưa món tương lai vào hôm nay hoặc trung bình 14 ngày. Log tập, chỉ số cơ thể và ghi chú cũng có cận trên. Tuần tập bắt đầu thứ Hai.
- Counter chat vẫn nằm trong RAM; thay đổi ở đây thống nhất ngày reset, không biến nó thành quota phân tán. Đây không phải hạng mục chống xác nhận trùng ở trên.

## Kiểm chứng

```powershell
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend
```

- Test schema/generation dùng provider giả lập để chủ động tạo JSON sai, ID sai, bài thiếu, đơn vị không quy đổi được và tổng calories sai. Test dinh dưỡng kiểm tra độc lập tổng của model với tổng từ khẩu phần.
- `backend/src/services/ai-hardening.integration.test.ts` chạy trên PostgreSQL thật, có kiểm tra concurrent accept, hai generation ghi chung bữa, rollback sau món đầu tiên, retry, chủ sở hữu, loại generation, thực phẩm bị xóa và ngày/snapshot.
- Test tích hợp chỉ chạy khi `AI_TEST_DATABASE_URL` trỏ tới `127.0.0.1/ai_hardening_test` và bằng DATABASE_URL. CI tạo PostgreSQL tạm, push schema vào database trống rồi chạy test. Không được trỏ tới dữ liệu production.
- Kiểm tra model thật bằng catalog giả lập: `models/gemini-2.5-flash` qua adapter OpenAI-compatible đã tạo chương trình hợp lệ. Thực đơn thử nghiệm 2.625 kcal cho mục tiêu 2.000 đã bị từ chối 422 đúng quy tắc; không coi lần này là sinh thực đơn thành công. Không gửi dữ liệu người dùng hoặc ghi database thật trong thử nghiệm model.

Các sơ đồ cũ phản ánh phiên bản trước thay đổi này; dùng luồng và hợp đồng trên khi đánh giá triển khai hiện tại.
