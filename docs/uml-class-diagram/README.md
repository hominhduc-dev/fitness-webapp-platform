# UML Class Diagram toàn hệ thống

Mở `class-diagram.html` để xem sơ đồ lớp có thể phóng to, kéo và đổi sáng/tối. Sơ đồ này bổ sung cho ERD: ERD mô tả bảng và quan hệ dữ liệu; UML mô tả các module/lớp, thuộc tính và phương thức chính.

Nguồn phương thức được đối chiếu từ `backend/src/services`, `backend/src/routes`, `backend/src/lib/ai`, `backend/src/lib/prisma.ts` và `backend/src/lib/supabase.ts`. Các lớp TypeScript không phải `class` (service module và provider factory) được biểu diễn như lớp dịch vụ để phản ánh trách nhiệm runtime.

Phạm vi gồm Next.js request boundary, Express routes, auth, AI, nutrition, fitness data, admin, AI providers, Prisma/Supabase gateways và domain objects. Các helper nội bộ nhỏ và từng Prisma delegate không được tách thành lớp riêng để tránh làm sơ đồ không đọc được.
