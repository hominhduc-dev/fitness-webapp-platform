---
name: frontend-system
description: Tra cứu và duy trì kiến trúc frontend YeahBuddy. Dùng cho mọi yêu cầu liên quan đến Next.js/React, UI, layout, component, responsive, theme sáng-tối, color palette, typography, liquid glass, navigation, accessibility, i18n, frontend data fetching, form, chart, PWA hoặc kiểm thử frontend trong repo fitness-app.
---

# Frontend System

## Quy trình bắt buộc

1. Đọc toàn bộ [references/frontend.md](references/frontend.md) trước khi phân tích hoặc sửa frontend.
2. Dùng bảng “Yêu cầu → nơi chịu trách nhiệm” trong tài liệu để khoanh vùng. Không quét toàn repo nếu tài liệu đã chỉ ra owner.
3. Chỉ mở các file owner và dependency trực tiếp cần cho yêu cầu hiện tại.
4. Ưu tiên token ngữ nghĩa, primitive và pattern có sẵn. Không tạo palette, layout shell, breakpoint hoặc API layer song song.
5. Với bug giao diện, kiểm tra theo thứ tự: owner component → semantic token/theme → responsive/safe area → client lifecycle → browser enhancement.
6. Chạy validation tương xứng: ESLint trên file đổi, `npm run typecheck`, test liên quan; dùng browser mobile/desktop khi hành vi trực quan cần xác nhận.
7. Nếu code và `frontend.md` khác nhau, coi code đang chạy là source of truth, sửa tài liệu trong cùng thay đổi và nêu rõ drift.
8. Sau khi đổi system design, token, provider, route strategy, navigation, shared primitive hoặc convention, cập nhật `references/frontend.md` trong cùng task.

## Nguyên tắc thay đổi

- Giữ Server Component làm mặc định; chỉ thêm `"use client"` tại ranh giới cần state, effect hoặc browser API.
- Component thường phải dùng named export; chỉ route files của Next.js dùng default export.
- Fetch initial data và enforce role ở server khi có thể; truyền dữ liệu đã typed xuống client component.
- Dùng `cn()` cho class có điều kiện và các component trong `components/ui` trước khi tạo primitive mới.
- Dùng màu semantic (`bg-background`, `text-foreground`, `border-border`, `text-primary`) thay cho màu literal trong JSX.
- Mọi copy hiển thị cho người dùng phải đi qua messages `en` và `vi`, trừ dữ liệu do backend trả về.
- Thiết kế mobile-first, giữ safe area, touch target, reduced motion và reduced transparency.
- Không sửa trực tiếp path SVG giải phẫu nếu yêu cầu chỉ liên quan mapping/highlight; kiểm tra layer `lib/fitness/muscle-*` trước.

## Khi tài liệu cần được làm mới

Cập nhật `frontend.md` nếu dependency, route/rendering, provider, shell/navigation, design token, shared primitive, breakpoint, accessibility rule, module ownership hoặc testing convention thay đổi.

Không cập nhật tài liệu cho chỉnh sửa copy hoặc style cục bộ không tạo ra convention mới.
