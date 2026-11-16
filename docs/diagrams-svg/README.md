# Tài nguyên trình chiếu báo cáo YeahBuddy Fitness

Hai bản PowerPoint gồm 20 slide và không có footer:

- [Bản nội dung ban đầu](../Ho-Minh-Duc-bao-cao-do-an-20-slide.pptx).
- [Bản thiết kế mới](../Ho-Minh-Duc-bao-cao-do-an-20-slide-thiet-ke-moi.pptx): bố cục và typography thống nhất, phần kiểm thử dùng số lớn và bảng tóm tắt.

## Các sơ đồ SVG

| Tệp | Nội dung | Trang trong tài liệu draw.io nguồn |
| --- | --- | --- |
| [02-module-ai.svg](02-module-ai.svg) | Module AI, đầy đủ 9 use case và 2 tác nhân | 2 |
| [13-sequence-ai-uc02.svg](13-sequence-ai-uc02.svg) | Tạo chương trình tập luyện | 13 |
| [15-sequence-ai-uc04.svg](15-sequence-ai-uc04.svg) | Cá nhân hóa kế hoạch dinh dưỡng | 15 |
| [17-sequence-ai-uc06.svg](17-sequence-ai-uc06.svg) | AI Agent điều chỉnh giáo án | 17 |
| [21-erd-du-lieu-ai.svg](21-erd-du-lieu-ai.svg) | ERD dữ liệu module AI | 21 |

Các SVG trong thư mục này được xuất trực tiếp từ draw.io, giữ nguyên nội dung và bố cục. Thư mục [compatible](compatible/) chứa cùng 5 sơ đồ với chữ chuyển thành đường vector qua bản PDF do draw.io xuất, để các trình xem không hỗ trợ HTML trong SVG vẫn hiển thị đủ chữ. Bản thiết kế mới dùng các SVG tương thích này; không vẽ lại sơ đồ.

Sơ đồ kiến trúc tổng thể và 4 ảnh giao diện được nhúng trong PowerPoint từ báo cáo Word gốc.

## Phạm vi số liệu

Số liệu kiểm thử trên slide là kết quả ghi trong báo cáo ngày **10/11/2026**: 243 ca trong 28 tệp, 235 đạt, 0 thất bại và 8 bỏ qua. Provider được giả lập; 8 ca tích hợp cần PostgreSQL thật chưa chạy. Các kết quả này không phải đánh giá chất lượng mô hình hoặc người dùng thật.
