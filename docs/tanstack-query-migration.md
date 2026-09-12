# TanStack Query migration

Ngày kiểm tra: 2026-09-12. Nhánh: `feat/tanstack-query-client-cache`.
Plan gốc: `C:\Users\PC\.claude\plans\t-i-p-d-ng-tanstack-elegant-valiant.md`.

## Trạng thái triển khai

Các nhóm code 0–7 đã tích hợp; nghiệm thu browser đầy đủ còn các mục bên dưới.

| Nhóm | Đã triển khai |
|---|---|
| 0 | QueryProvider, browser singleton/server isolation, token helper, keys, devtools, test provider |
| 1 | Mutation hooks cho workout và coach; invalidation sau ghi |
| 2 | Profile, weight, meals, progress dùng query thay fetch effects/seed-consumed flags |
| 3 | Workout collection dùng chung; sidebar nav-counts; dashboard nhận SSR seed và observe cache |
| 4 | Coach programs/editor/trainees/import; logs dùng infinite query; export dùng fetchQuery |
| 5 | Session seed kết hợp localStorage, cache không tự refetch; lịch giữ optimistic null tombstone và lỗi program query |
| 6 | Admin queries/mutations và các luồng AI |
| 7 | Xóa hai module dashboard-refresh cũ; pull-to-refresh invalidate; auth clear cache khi logout/đổi tài khoản |

## Quy ước cache

- Private query key gồm domain/filter và `profile.id`, không chứa access token.
- `requireAccessToken()` đọc token tại thời điểm query/mutation; refresh token không xóa cache.
- Seed SSR giữ typed `Date` qua props; không dehydration; seed thất bại `null` thành `undefined`.
- Mặc định stale 30 giây, GC 5 phút; reference 30 phút; bán tĩnh 5 phút.
- Workout start dùng `staleTime: "static"` thay `Infinity` trong plan: chặn cả refetch do invalidation khi đang nhập set. UI vẫn reconcile kết quả swap riêng, giữ draft/localStorage.
- Export và infinite-list có key riêng để không trộn page object với InfiniteData.
- Meals writeback giữ user/date lúc mutation bắt đầu, tránh vá nhầm ngày khi người dùng điều hướng trước lúc API trả về.
- Auth có revision guard cho response đến muộn; bootstrap profile luôn đọc mới, không lấy snapshot cũ ghi đè profile hiện tại.
- `router.refresh()` còn ở locale-provider là có chủ đích: locale cần render lại Server Components, không phải refresh dữ liệu fitness.

## Invalidation chính

| Ghi dữ liệu | Cache cập nhật / invalidate |
|---|---|
| Workout/routine/program/log | Workouts, progress; log thêm coach |
| Weight | Progress, profile |
| Meal item | Writeback nutrition ngày bắt đầu mutation; invalidate ngày đó và dashboard |
| Custom food | Tất cả biến thể foods |
| Coach assign/unassign/program/request | Coach domain gồm nav-counts và trainee detail; các mutation generic thêm workouts |
| Coach exercise | Coach và exercises |
| Profile/avatar | Writeback profile; profile update thêm meals |
| Reset trainee data | Progress, workouts, meals, profile |
| AI accept | Domain workout/meal liên quan và dashboard |
| Logout/account switch | Clear toàn bộ QueryClient |

## Kết quả kiểm tra

- `npm run typecheck`: đạt.
- `npm test`: 69/69 test, 11 file đạt.
- `npm --prefix backend run test`: 272 đạt, 8 bỏ qua, không có test thất bại.
- `npm run lint`: 0 error, 35 warning (plan ghi baseline 54).
- `npm run lint:colors`: đạt.
- `npm run build`: production compilation, TypeScript và generation routes đạt.
- Bộ regression mới kiểm tra seed không gọi mạng, cache qua provider remount, account isolation, token mới, invalidation weight, null seed retry, frozen session query, meal-date race, cursor pagination và auth events.
- Browser phiên coach: danh sách programs, mở/đóng editor và coach dashboard render; không ghi nhận error trong log browser được đọc. Không lưu/sửa dữ liệu thật.

## Chưa nghiệm thu trực tiếp

- Chưa có phiên trainee/admin để kiểm tra đủ ba role và mọi mutation trên browser.
- Chưa đo lại request timing `/progress → /meals → /progress`; không khẳng định đã đạt 0 request thực tế. Hook test seed/cache reuse đã đạt, nhưng không thay thế phép đo browser.
- Chưa thử nhập set trong một buổi tập thật rồi chuyển tab/quay lại; regression hiện kiểm tra query không tự refetch, không phải toàn bộ UI logger.
- Chưa kiểm tra drag/drop lịch với API lỗi thực tế và cập nhật badge sau duyệt request thật.

Để nghiệm thu: dùng tài khoản/dữ liệu test cho từng role; thực hiện các thao tác trên, kiểm tra Network trong staleTime, xác nhận draft không mất và dữ liệu sau mutation đúng. Không thay role hoặc sửa tài khoản đang dùng để tạo điều kiện test.

Các thay đổi tích hợp hiện chưa commit; không có cam kết rollback độc lập từng nhóm cho phần diff chưa commit.
