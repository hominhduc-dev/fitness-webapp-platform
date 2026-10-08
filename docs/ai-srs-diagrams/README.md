# SRS AI và sơ đồ

SRS chính: [ai-features-report.tex](../ai-features-report.tex). Baseline code: `772cb878`, 05/10/2026.

Report cập nhật 08/10/2026 bổ sung Phase 1–4 và UC-AG-01–05. Bộ sơ đồ này giữ baseline 05/10/2026; sequence chat chưa phản ánh loop Phase 1, chưa có sequence cho API agent mới. Artifact được tham chiếu riêng, không nhúng vào PDF. Compiler lần 08/10 lỗi chuẩn bị preview (`helper_unknown_error: setup refresh had errors`); chưa xác nhận PDF.

Mở [index.html](index.html) để xem 15 sequence và use case UML chia 5 nhóm. `requirements.json` chứa đặc tả có mã UC/FR/AC; source PlantUML và Mermaid dùng để chỉnh sửa.

## Phạm vi

Trainee, coach và CLI vận hành; provider là actor hỗ trợ. Accept/consume/review không gọi LLM. UC-06 và UC-11/12 có nhánh đọc không gọi provider. DB không phải actor use case. API AI chung chưa chặn riêng role trainee ở toàn router.

HTML Archify thể hiện happy path; SRS/nguồn Mermaid mô tả ngoại lệ. Mermaid thể hiện alt/opt. Sơ đồ lifecycle chi tiết nằm trong SRS; không suy diễn mọi generation type đều accept/discard.

## Tái tạo

Từ repo root: `node docs/ai-srs-diagrams/build.cjs`. Chỉ sinh tài liệu, không gọi provider/DB. Sau đó chạy Archify validate/deliver cho từng sequence JSON; không coi JSON mới là HTML đã validate.

## Trạng thái kiểm tra

Chưa nghiệm thu các AC, chưa gọi live provider hay kiểm tra production. Compiler LaTeX tích hợp cần kiểm tra riêng. Validation/render/browser receipts được ghi sau khi chạy thực tế.

## Kết quả lần bàn giao 05/10/2026

- 15/15 sequence: validate/deliver 9/9 showcase, 0 errors, 0 warnings.
- 15/15 automated browser checks pass: 1440x900, 1600x1000, 1920x1080, 2048x1320; light/dark theo coverage của tool.
- Use-case viewer: 5 SVG, 15 UC, không tràn ngang ở 1440x900; index không có link nội bộ bị thiếu.
- Kiểm tra trực quan mẫu: use-case training và sequence chat/accept/coach-program/consume/daily/draft.
- LaTeX compile chưa xác minh: compiler tích hợp trả Unable to find standard directories for platform.
- Chưa chạy test ứng dụng, live provider, production hoặc nghiệm thu AC.

Receipts, ảnh kiểm tra và contact sheets ở verification/. Artifact HTML/JSON giữ nguyên checksum đã kiểm tra. Khi regenerate, chạy validate/deliver/visual-check lại; các tool ghi receipt tại root trước khi gom vào verification/.
