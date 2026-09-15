# Đo lường đăng ký miễn phí

Mục tiêu chính là tài khoản miễn phí được tạo thành công, không phải lượt nhấp vào nút đăng ký. Landing page gửi `registration_form_view`, `registration_form_submit`, `registration_form_error` và `sign_up`. `sign_up` chỉ được gửi khi `/api/auth/register` trả về thành công. Sự kiện có `method: email` và `email_confirmation_required`; không gửi email, tên, số điện thoại hay nội dung lỗi.

Trên Vercel, các sự kiện được gửi qua Vercel Analytics. Để xem nguồn truy cập Google và đánh dấu `sign_up` là key event trong GA4, đặt `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...` trong môi trường deploy. Nếu không có ID hợp lệ, website không tải Google tag. Xác minh bằng GA4 DebugView hoặc báo cáo Realtime trước khi dùng số liệu để tối ưu quảng cáo.

Đăng ký Google/Apple được ghi nhận ở bước bắt đầu OAuth (`registration_form_submit`), nhưng chưa gửi `sign_up` vì callback hiện không phân biệt tài khoản mới với người dùng đăng nhập lại. Tỷ lệ xác nhận email và buổi tập đầu tiên cũng cần đo riêng trước khi xem là người dùng đã bắt đầu sử dụng.

Sau khi có dữ liệu nền, so sánh các phiên bản CTA hoặc biểu mẫu bằng tỷ lệ `sign_up / landing page views`, đồng thời theo dõi `email confirmation / sign_up`. Không kết luận chỉ từ số lượt mở biểu mẫu.
