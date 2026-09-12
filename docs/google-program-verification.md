# Kiểm chứng Google Sheets — 12/09/2026

Luồng chính đã chạy với Google Sheets API thật và database hiện tại trên branch `feat/notion-program-import`. Đã phát hiện, sửa và kiểm tra lại lỗi xuất đồng thời nhiều tuần có hơn 5 sets. Chưa thể nghiệm thu đối chiếu template chuẩn vì file gốc không còn ở đường dẫn đã cung cấp; người dùng xác nhận `Coach Program Template.xlsx` không phải bản chuẩn và sẽ cung cấp đường dẫn đúng.

## Kết quả theo chức năng

| Chức năng | Bằng chứng | Kết quả |
|---|---|---|
| Kết nối Google | Lấy token từ kết nối hiện hữu, gọi Sheets API thật; UI hiển thị connected | Đạt với kết nối hiện hữu |
| OAuth state, crypto, refresh, disconnect | Unit tests chữ ký/nonce/thời hạn, ciphertext, refresh không mất refresh token, không khôi phục grant đã disconnect, từ chối thiếu quyền | Đạt; không ngắt kết nối hoặc làm lại consent trên tài khoản thật |
| Chọn sheet / preview | Chrome tại `/coach/programs`: lấy danh sách, chọn Week 1, preview 4 tuần/20 buổi/104 lượt bài; ID hợp lệ | Đạt; không lưu chương trình từ sheet người dùng trong bước UI này |
| Parse dữ liệu | Sheet thử có Day gộp, ID ẩn, công thức INDEX/MATCH, rep range, RIR=0, Rest=90, Note | Đạt với API thật |
| Tạo và nhập lại | Tạo bằng service thật; import lại tìm đúng program/assignment count; overwrite giữ trainee | Đạt |
| Đổi bài | Gọi service swap thật; kiểm tra originalVariationId và nguồn spreadsheet trong program đang được giao | Đạt |
| Lưu log | Gọi service lưu log thật cho hai tuần sau swap; export dùng snapshot tuần/ngày/order | Đạt |
| Ghi kết quả | Tuần 1 có 7 sets, tuần 2 mới có 6 sets; ghi đúng reps/weight, Substitute và set chưa hoàn thành để trống | Đạt sau sửa |
| Bảo toàn prescription | Đọc lại A:H, RIR, Rest, Note sau ghi; xác minh công thức ID còn nguyên/cột E vẫn ẩn | Đạt |
| Khôi phục dropdown | Đọc grid metadata từ Google: C dùng ONE_OF_RANGE strict, I không có validation | Đạt |
| Xuất lại | Xuất cùng log lần nữa, so sánh toàn bộ giá trị hai tuần | Không phát sinh thay đổi |
| Sai ID | Sửa ID ở tuần 2 rồi xuất cả hai tuần; service từ chối và tuần 1 không thay đổi | Đạt, không ghi một phần |
| Một spreadsheet/học viên | Unit tests chặn assignments và lịch sử log của học viên khác | Đạt |
| Log cũ thiếu tuần | Unit test từ chối trước khi ghi | Đạt |
| Template trong ứng dụng | Test XLSX round trip: 17 cột, E ẩn/header rỗng, Day gộp, C dropdown strict, I không dropdown, chỉ Week 1, tuần được nhân trong app | Đạt theo hợp đồng handoff; chưa so với file chuẩn mới |

## Lỗi đã sửa

Trước sửa, batch ghi tuần 1 mở từ 5 lên 7 cột kết quả, rồi mới duplicate sang tuần 2. Tuy nhiên kế hoạch tuần 2 được tính từ bố cục 5 cột đã đọc trước đó. Google thực tế trả HTTP 400: vùng unmerge không chứa trọn vùng đã gộp.

`google-program-export.service.ts` hiện gom mọi `duplicateSheet` lên đầu **cùng một batch atomic**, rồi mới áp dụng thay đổi từng tuần. Tất cả tuần vẫn được kiểm tra trước khi gọi API. Test hồi quy bao gồm tuần 1 và hai tuần mới để bảo đảm thứ tự này không tái xuất hiện.

## Phạm vi kiểm chứng và phần còn lại

- Các phép ghi thật dùng spreadsheet và trainee tổng hợp riêng. Sau mỗi lần chạy, xóa đúng dữ liệu thử trong DB và chuyển spreadsheet thử vào thùng rác Google Drive. Không sửa chương trình hoặc kết quả tập hiện hữu.
- Giao diện import đã được thao tác trực tiếp; luồng create/overwrite/swap/log/export được kiểm qua các service thật, không phải toàn bộ thao tác nhấn nút bằng trình duyệt.
- Việc export hiện được coach kích hoạt bằng nút xuất log. Chưa có tác vụ tự động ghi Sheets ngay khi học viên hoàn thành buổi tập.
- Chưa chạy lại màn hình consent hoặc thu hồi kết nối thật; các nhánh này được kiểm bằng test tự động.
- Chưa kiểm chứng layout, màu sắc, công thức và validation với **file template chuẩn của người dùng**. Đang chờ đường dẫn mới; không dùng file khác làm chuẩn thay thế.
- Không bật Sleep khi phần đối chiếu bắt buộc này còn thiếu.

## Kiểm tra mã nguồn

- Frontend: 45 tests passed; `npm run typecheck` passed (có `next typegen` trước `tsc`).
- Backend: toàn bộ suite đạt 258 tests, 8 tests AI integration bị skip. Các test Google tập trung có 23 ca.
- Backend typecheck và production build passed. `git diff --check` không có lỗi whitespace.

Harness kiểm tra thật của phiên này: `.codex/google-live-check.ts` (gitignored, dùng cấu hình backend hiện hữu, không chứa token/secret).
