export const feedbackMessages = {
  en: { feedback: {
    title: "Report a bug / Feedback", description: "Help us improve YeahBuddy. Your report is private to you and our admins.",
    affectedPage: "Which page has the issue?", invalidPath: "Enter an internal path such as /workout.", category: "Type", bug: "Bug report", suggestion: "Suggestion", message: "Description", placeholder: "What happened? What did you expect? Include steps to reproduce.",
    screenshot: "Screenshot (optional)", chooseScreenshot: "Attach image", changeScreenshot: "Change image", removeScreenshot: "Remove image", attachmentHint: "PNG, JPEG or WebP, up to 1 MB. Remove private information before uploading.",
    context: "The current page, app version and browser information are included. Passwords and chat contents are not collected automatically.",
    send: "Send feedback", sending: "Sending…", success: "Feedback sent. Thank you!", invalid: "Please enter 10–3000 characters.", invalidFile: "Choose a PNG, JPEG or WebP image up to 1 MB.",
    error: "Unable to complete the request. Please try again.", conflict: "This report changed. Reload it before updating.", recent: "Your feedback", empty: "No feedback yet.",
    statuses: { new: "New", in_progress: "In progress", resolved: "Resolved" }, all: "All", status: "Status", details: "Details", save: "Save status", refresh: "Refresh", previous: "Previous", next: "Next", page: "Page", reporter: "Reporter", pagePath: "Page", browser: "Browser", version: "App version", adminTitle: "Feedback", adminDescription: "Review bug reports and suggestions from users.",
  } },
  vi: { feedback: {
    title: "Báo lỗi / Góp ý", description: "Giúp YeahBuddy tốt hơn. Chỉ bạn và quản trị viên xem được phản hồi này.",
    affectedPage: "Trang nào gặp vấn đề?", invalidPath: "Nhập đường dẫn nội bộ, ví dụ /workout.", category: "Loại phản hồi", bug: "Báo lỗi", suggestion: "Góp ý", message: "Mô tả", placeholder: "Bạn gặp vấn đề gì? Bạn mong đợi điều gì? Nêu các bước để tái hiện lỗi.",
    screenshot: "Ảnh chụp (tùy chọn)", chooseScreenshot: "Đính kèm ảnh", changeScreenshot: "Đổi ảnh", removeScreenshot: "Xóa ảnh", attachmentHint: "PNG, JPEG hoặc WebP, tối đa 1 MB. Xóa thông tin riêng tư trước khi tải ảnh lên.",
    context: "Đính kèm trang hiện tại, phiên bản ứng dụng và thông tin trình duyệt. Không tự thu thập mật khẩu hoặc nội dung chat.",
    send: "Gửi phản hồi", sending: "Đang gửi…", success: "Đã gửi phản hồi. Cảm ơn bạn!", invalid: "Vui lòng nhập từ 10–3000 ký tự.", invalidFile: "Chọn ảnh PNG, JPEG hoặc WebP tối đa 1 MB.",
    error: "Không thể thực hiện yêu cầu. Vui lòng thử lại.", conflict: "Phản hồi đã thay đổi. Hãy tải lại trước khi cập nhật.", recent: "Phản hồi của bạn", empty: "Chưa có phản hồi.",
    statuses: { new: "Mới", in_progress: "Đang xử lý", resolved: "Đã giải quyết" }, all: "Tất cả", status: "Trạng thái", details: "Chi tiết", save: "Lưu trạng thái", refresh: "Tải lại", previous: "Trước", next: "Tiếp", page: "Trang", reporter: "Người gửi", pagePath: "Đường dẫn", browser: "Trình duyệt", version: "Phiên bản", adminTitle: "Phản hồi", adminDescription: "Xử lý báo lỗi và góp ý từ người dùng.",
  } },
} as const
