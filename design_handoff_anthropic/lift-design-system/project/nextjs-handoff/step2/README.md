# Step 2 — kết quả kiểm tra repo thật

Tôi đã đọc trực tiếp `hominhduc-dev/fitness-app@main`. **Phần lớn Step 2 đã được áp dụng sẵn** trong các component thật:

| Hạng mục Step 2 | Trạng thái | Bằng chứng |
|---|---|---|
| 2a. Bỏ shadow ở Card | ✅ Đã xong | `dashboard/stats-card.tsx`, `dashboard/today-workout.tsx` dùng `border bg-card`, không có class `shadow-*` |
| 2a. Bỏ shadow ở Button | ⚠️ Còn 1 chỗ | `ui/button.tsx` → variant `outline` vẫn còn `shadow-xs` |
| 2b. Số tabular | ✅ Đã xong | Khắp nơi dùng `font-mono tnum` (stats-card, today-workout...) |
| 2c. Micro-labels | ✅ Đã xong | Class `.label-micro` đã dùng rộng; `ui/badge.tsx` có sẵn variant `micro` |
| 2d. Voice & copy | ✅ Đã xong | Sentence-case qua i18n messages, không emoji |

> Lưu ý: `ui/input.tsx` cũng đã sạch (hairline, không shadow). Shadow ở `dialog.tsx` / `dropdown-menu.tsx` là **đúng spec** (Lift cho phép shadow trên modal & menu — `--shadow-2`, `--shadow-3`), nên giữ nguyên.

## Thay đổi duy nhất cần làm

`components/ui/button.tsx`, variant `outline` — bỏ `shadow-xs`:

```diff
       outline:
-        'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
+        'border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
```

## Cách áp dụng

Cách 1 — copy đè file đã sửa sẵn:
```bash
cp <this-project>/nextjs-handoff/step2/button.tsx ./components/ui/button.tsx
```

Cách 2 — sửa tay 1 dòng: mở `components/ui/button.tsx`, xoá ` shadow-xs` trong variant `outline`.

Chạy `npm run dev` để xem.

## Step 3 — KHÔNG nên overwrite

Các màn của bạn đã là component thật, nối dữ liệu Supabase/i18n, lớn hơn nhiều so với prototype:
- `coach/program-editor.tsx` (56 KB), `coach/trainee-detail-client.tsx` (44 KB)
- `app/workout/[id]/start/page.tsx` (31 KB — Today log thật)
- `schedule/weekly-calendar.tsx`, `progress/weight-tracking-client.tsx`...

Đè prototype `.jsx` lên đây = mất logic thật. Thay vào đó nên: **audit từng màn so với spec Lift** rồi đưa diff polish có mục tiêu (nếu phát hiện chỗ lệch). Cho tôi biết màn nào bạn thấy "chưa giống thiết kế" để tôi soi đúng chỗ đó.
