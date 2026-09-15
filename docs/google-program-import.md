# Google Sheets: import và ghi kết quả

## Cấu hình

- Tạo OAuth Web application client, bật Sheets API và Drive API.
- Điền `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY` trong `backend/.env`.
- Redirect local: `http://localhost:3000/backend/api/coach/google/callback`. Production dùng cùng origin frontend và đường dẫn `/backend/api/coach/google/callback`, để cookie chống CSRF được gửi lại. Đăng ký đúng URI này trong Google Console.
- Encryption key: 32 byte ngẫu nhiên, base64. Có thể sinh bằng `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; chỉ lưu vào môi trường máy chủ.
- Khởi động lại backend sau khi đổi `.env`. Thiếu cấu hình hoặc key sai: tab Google được ẩn.
- Quyền `spreadsheets` là đọc/ghi spreadsheet của tài khoản. `drive.file` không thu hẹp quyền này. Token được mã hóa; bảng GoogleConnection chỉ backend truy cập.

## Sử dụng

1. Coach mở Import chương trình → Google Sheets → Kết nối Google.
2. Sau khi consent, mở lại Import → Google Sheets, dán link, chọn sheet tuần mẫu và số tuần.
3. Xem trước, sửa lỗi ở nguồn nếu có, tạo chương trình hoặc ghi đè bản đã import. Ghi đè giữ nguyên assignments.
4. Mỗi học viên có một spreadsheet riêng. Chương trình cùng spreadsheet có assignments hoặc log của học viên khác sẽ bị chặn khi export.
5. Tại log học viên, chọn khoảng ngày/chương trình và dùng nút export Google Sheets hiện có. Đây là export theo thao tác của coach, chưa phải tác vụ nền tự chạy khi kết thúc buổi tập.

## Hợp đồng dữ liệu

- Week 1 có 17 cột theo handoff; E là ID ẩn, header rỗng. Exercise dropdown lấy từ Exercise Table. Note, RIR và Rest được giữ khi nhập.
- Day 1–6 được nối xuống các ô gộp; chỉ author một tuần. App tạo các tuần theo số tuần đã chọn.
- Kết quả ghép theo Day + order (bắt đầu từ 1) + originalVariationId, hoặc variation hiện tại nếu chưa đổi bài. Không dùng số dòng lưu từ lần import.
- Cột Actual ghi `reps × weight kg`; set chưa hoàn thành để trống. Hơn 5 sets: chèn cột trước RIR, không ghi vào prescription.
- Thiếu Week N: duplicate tuần mẫu và xóa phần kết quả được sao chép trước khi ghi. Batch đồng thời khôi phục dropdown Exercise từ Exercise Table.
- Toàn bộ batch được kiểm tra trước khi gửi. Nếu không khớp dòng, thiếu snapshot tuần/ngày/order hoặc nhiều log cạnh tranh cùng ô, báo lỗi trước khi ghi.
- Không có cơ chế khóa chỉnh sửa spreadsheet: tránh chèn/xóa/sắp xếp hàng trong lúc export đang chạy.
- Chương trình không có nguồn Sheets tiếp tục export qua n8n như trước.

## Coach export nhiều spreadsheet

- Export theo tuần hoặc theo chương trình ghi vào đúng spreadsheet mà chương trình của log được import. Log thuộc nhiều spreadsheet (hoặc nhiều sheet tuần mẫu) được tách nhóm, mỗi nhóm một batch riêng; kết quả trả về danh sách file kèm link.
- Log chưa hoàn thành hoặc không có `programId` bị bỏ qua và báo số lượng (`skippedLogCount`). Các nhóm ghi tuần tự, nên lỗi ở file sau không hoàn tác file trước.

## Trainee export vào Drive riêng

- Trainee kết nối Google ngay trong dialog Export ở /progress. Kết nối dùng chung `GoogleConnection` và endpoint `/api/google/{connection,authorize}`; callback vẫn là redirect URI đã đăng ký (`/api/coach/google/callback`) và đưa trainee về `/progress?google=connected`.
- Mỗi chương trình được giao có một spreadsheet trong Drive của trainee (thư mục `YeahBuddy workout logs`), lưu ở `ProgramAssignment.traineeGoogleSpreadsheetId` (migration `20260918_add_trainee_google_spreadsheet`). File bị xóa thì lần export sau tạo file mới.
- Tab `Program` ghi thông tin chương trình; mỗi tuần có log là một tab `Week N` cùng bố cục sheet coach (E là variation id ẩn, cột kết quả `reps × weight kg`, thêm cột set khi cần) nên `parseGoogleProgramRows` vẫn đọc được.
- Tuần xác định theo `plannedDate` so với tuần bắt đầu chương trình (`startDate` hoặc ngày giao); prescription lấy theo quy tắc hiển thị (tuần chưa author lặp lại tuần author gần nhất).
- App sở hữu file nên mỗi lần export dựng lại toàn bộ tab tuần từ database (xóa và thêm lại tab trong một batch, ghi `RAW`). Chỉnh sửa tay trong tab tuần sẽ bị ghi đè; buổi tập mới nhất của một ngày thắng.
- Trainee chưa kết nối Google: nút export Sheets bị khóa. Deployment không cấu hình Google OAuth vẫn dùng n8n như trước.

## Migration và kiểm chứng

- Đã áp dụng `20260912_google_program_roundtrip`: nguồn Sheets trên Program, originalVariationId trên WorkoutExercise, RLS và thu hồi quyền Data API cho GoogleConnection.
- Các log cũ thiếu snapshot gốc/tuần không được suy đoán để ghi ngược. Backend ghi snapshot mới từ prescription đã lưu, không tin metadata gốc do client gửi.
- Test gồm crypto/state, refresh giữ refresh token, disconnect, parser, key mismatch, thêm set, template XLSX xuất/nhập nhiều tuần.
- Kiểm chứng ngày 12/09/2026: cấu hình và kết nối Google hiện hữu đã dùng được với API thật. Đã chạy import → tạo/ghi đè giữ assignments → đổi bài → lưu log → export tuần 1/2 bằng dữ liệu thử riêng; chi tiết tại [báo cáo kiểm chứng](google-program-verification.md).
- Đã sửa lỗi batch nhiều tuần: sao chép tất cả sheet tuần mới trước khi thêm cột kết quả vào tuần mẫu. Nếu sửa tuần mẫu trước, sheet sao chép có bố cục khác với lúc lập kế hoạch, khiến Google từ chối vùng merge hoặc ghi lệch cột.

Nguồn API: [Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server), [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).
