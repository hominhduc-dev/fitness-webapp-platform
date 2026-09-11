# Kiểm thử giao diện AI — 11/09/2026

Kiểm thử thủ công bằng trình duyệt trên frontend localhost:3000 và backend localhost:4000, từ worktree của PR #84. Đăng nhập hai tài khoản coach/trainee do chủ dự án cung cấp. Dùng dịch vụ auth, database và model đang cấu hình của dự án; không mock phản hồi trong các bước UI. Không lưu credentials trong báo cáo.

| Luồng | Kết quả quan sát |
|---|---|
| Coach đăng nhập | Thành công; dashboard và danh sách chương trình tải được. |
| Coach truy cập AI Workout Builder | Chuyển về /coach; không có chat bubble. AI trên giao diện hiện dành cho trainee. Đây là kiểm tra UI, không phải kiểm chứng mọi API phân quyền. |
| Trainee đăng nhập | Thành công; có AI Workout Builder, thực đơn và chat. |
| Sinh buổi tập đơn lẻ | 30 phút, bodyweight, 6 bài, 18 set, mapping 100%. |
| Lưu buổi đơn lẻ | Thành công; màn hình bắt đầu tập có reps/RIR và đủ bài. Hủy buổi đang chạy khi chưa hoàn thành set, không tạo thành tích tập giả. |
| Sinh chương trình | 4 tuần, 3 buổi/tuần, 45 phút, home dumbbells; preview đủ 3 buổi, mỗi buổi 6 bài và 18 set. |
| Lưu chương trình | Thành công; có trong danh sách và trang chi tiết, đúng 3 buổi của tuần mẫu. |
| Thực đơn không hợp lệ | Hai lần đầu bị chặn 422 vì quá 3 món/bữa; lần sau bị chặn UUID sai. Không có nút chấp nhận bản lỗi, không lưu thiếu món. |
| Thực đơn hợp lệ sau điều chỉnh | Đủ 4 bữa/11 món. Tổng kcal trên preview khớp trang Meals sau lưu và sau reload; nằm trong ±10% mục tiêu. |
| Chat ngày và lịch sử | Trả đúng ngày Việt Nam, tình trạng chưa ghi bữa trước test và buổi hoàn thành gần nhất; không coi buổi test đã hủy là hoàn thành. |
| Chat sau lưu thực đơn | Đọc đúng tổng kcal mới và phần còn lại. Sau khi sửa context, kiểm thử lại trả đúng protein đã vượt mục tiêu, không còn nói thiếu. |

## Sửa phát sinh từ UI test

- Mẫu JSON thực đơn có đủ bốn bữa; nhắc lại số món và giới hạn calories sau catalog, hướng dẫn tăng khẩu phần thay vì thêm món vượt giới hạn.
- Thực đơn được phép sửa output tối đa một lần, vẫn kiểm tra schema/catalog/calories trước khi đánh dấu completed. Test kiểm tra sửa thành công, giới hạn retry, tổng token và lỗi provider.
- Context dinh dưỡng dùng từ rõ ràng cho thiếu/vượt/đạt mục tiêu, với test cho cả ba trường hợp.

## Giới hạn và phát hiện còn lại

- Khẩu phần vẫn có thể hợp lệ về số học nhưng không thực tế, ví dụ sữa 1 ml hoặc cam 1 g. Cần quy tắc khẩu phần thực tế theo từng loại thực phẩm; không tự áp cùng một ngưỡng gram cho cả rau, dầu và gia vị.
- Bộ lọc thiết bị phụ thuộc metadata của catalog. Bài mang nhãn Bodyweight có thể vẫn cần điểm tựa/xà (inverted row); bài Dumbbell có thể cần ghế. Chưa có metadata phụ kiện đủ chi tiết để khẳng định “không thiết bị” theo nghĩa tuyệt đối.
- Không dùng UI để giả lập race condition hoặc chèn bữa tương lai vào dữ liệu tài khoản. Các tình huống concurrent accept, rollback, snapshot và biên ngày được kiểm chứng bằng test PostgreSQL tách biệt trong CI.
- Dữ liệu do test tạo gồm một buổi đơn lẻ, một chương trình và thực đơn 11 món trong tài khoản trainee. Các bản này được giữ lại để chủ dự án kiểm tra; không xóa dữ liệu tài khoản.
- Không ghi nhận việc meal repair đã được kích hoạt trong lần UI thành công chỉ từ kết quả 201; số lần gọi và giới hạn repair được kiểm chứng bằng test có kiểm soát.

Kiểm tra cục bộ sau sửa: backend typecheck/build đạt, 235 test thường đạt (8 test PostgreSQL được chạy riêng trong CI), ESLint các file sửa và git diff --check đạt.
