# Migration playbook — Lift design → YeahBuddy Fitness (Next.js)

> Repo: [hominhduc-dev/fitness-app](https://github.com/hominhduc-dev/fitness-app)
> Stack hiện tại: **Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (new-york) + Supabase**

## TL;DR — Step 1 sẽ đổi 90% giao diện

Vì codebase đã dùng **shadcn/ui với CSS variables** (`--background`, `--primary`, `--border`, …), **chỉ cần swap giá trị token** là toàn bộ app — Button, Card, Dialog, Sidebar, Form, Chart — sẽ tự pick up Lift's look. Không phải sửa từng component.

---

## Step 1 — Drop in 2 files (CSS tokens + fonts)

Copy 2 file trong folder này đè lên repo:

| File trong handoff | Vị trí trong repo | Tác dụng |
|---|---|---|
| `app/globals.css` | `app/globals.css` | Thay toàn bộ design tokens |
| `app/layout.tsx` | `app/layout.tsx` | Đổi font Inter → Geist + Geist Mono |

Hoặc copy-paste thủ công nếu bạn muốn cẩn thận từng dòng.

**Apply xong, chạy:**
```bash
npm run dev
```

App sẽ chuyển từ "SaaS xanh dương" → "warm minimal" ngay lập tức.

---

## Tokens đã đổi gì?

| Variable | Cũ (FitDash blue SaaS) | Mới (Lift warm minimal) | Ý nghĩa |
|---|---|---|---|
| `--background` | `#f8fafc` cool gray-blue | `#fcfcfa` warm paper white | Nền chính ấm hơn |
| `--foreground` | `#1e293b` slate | `#1a1a17` warm near-black | Text contrast cao hơn, ấm hơn |
| `--primary` | `#1349ec` saturated blue | `#3a5fff` electric blue | Accent dùng *sparingly* |
| `--card` | `#ffffff` pure white | `#fcfcfa` warm | Card hòa vào background |
| `--border` | `#e2e8f0` cool gray | `#ebebe6` warm hairline | Borders thay vì shadows |
| `--muted` | `#eff3ff` light blue | `#f5f5f1` warm gray | Surface raised |
| `--muted-foreground` | `#64748b` slate-500 | `#4a4a44` warm gray | Secondary text |
| `--success` | `#22c55e` bright green | `#2a8a5f` forest | Desaturated |
| `--destructive` | `#ef4444` bright red | `#c0341a` brick | Desaturated |
| `--radius` | `0.75rem` (12px) | `0.625rem` (10px) | Tighter, less playful |
| Font sans | **Inter** | **Geist** | Modern, neutral |
| Font mono | system mono | **Geist Mono** | Tabular numbers (kg, reps, timers) |

Tất cả `--chart-*` cũng đổi để chart Recharts dùng accent + ink-ramp thay vì 4 màu khác nhau.

---

## Step 2 — Recommended polish (1–2 giờ)

Sau khi Step 1 chạy ngon, một số component cần tinh chỉnh để đạt **Lift level**:

### 2a. Bỏ shadow ở Card / Button
shadcn `new-york` mặc định có shadow nhẹ. Lift = hairline only.
Mở `components/ui/card.tsx` và sửa class wrapper từ `shadow-sm` → bỏ hoặc thay bằng `border`.

```diff
- className="rounded-lg border bg-card text-card-foreground shadow-sm"
+ className="rounded-lg border bg-card text-card-foreground"
```

Tương tự `components/ui/button.tsx` — đổi default variant từ có shadow sang flat:
```diff
- "bg-primary text-primary-foreground shadow hover:bg-primary/90"
+ "bg-primary text-primary-foreground hover:bg-primary/90"
```

### 2b. Numbers tabular
Mọi chỗ hiển thị số (kg, reps, weight, calo, macro) thêm class `tnum` hoặc `font-mono`. Lift đã có rule:
```css
.tnum { font-feature-settings: "tnum" 1, "lnum" 1; }
```

Ví dụ trong `components/dashboard/`:
```tsx
<span className="text-2xl font-semibold tnum">{weight}</span>
<span className="text-sm text-muted-foreground">kg</span>
```

### 2c. Micro labels — UPPERCASE mono
Lift dùng `.label-micro` cho labels như "SET 1", "WORKING", "VOLUME". Đã include trong `globals.css`:
```tsx
<div className="label-micro">Today · push day</div>
```

### 2d. Voice & copy
Theo Lift voice guide (`/README.md`):
- Sentence case mọi buttons / headings
- Bỏ emoji
- Coach-y minimal: `"Today — Push day."` thay vì `"Welcome back, hero! 💪"`

---

## Step 3 — Components muốn pixel-perfect Lift?

Nếu bạn muốn migrate các UI screens (Today log với set rows, Rest timer, Trainer client list, …) chuẩn pixel với prototype, mình có sẵn ở `/ui_kits/web/` (file `.jsx`). Để convert sang Next.js:

1. Convert mỗi `.jsx` → `.tsx` trong `components/<feature>/`
2. Thêm `"use client"` directive ở dòng đầu (vì dùng `useState`)
3. Đổi `import { Icon }` → `import { Dumbbell, Calendar, ... } from "lucide-react"`
4. Thay inline styles bằng Tailwind classes nếu muốn (optional — inline styles vẫn hoạt động)

**Component candidates ưu tiên convert:**
- `TodayScreen.jsx` → `components/workout/active-session.tsx` (set log)
- `RestTimer.jsx` → `components/workout/rest-timer.tsx` (signature blur footer)
- `TrainerApp.jsx` → cho `app/(shell)/coach/trainees/`
- `Landing.jsx` → restyle `components/landing/landing-page.tsx`

Mình có thể làm bước này — chỉ cần bạn say go.

---

## Step 4 — Test checklist sau migration

- [ ] `app/page.tsx` (landing) — hero, features render với typo Geist
- [ ] `app/(shell)/dashboard` — cards có border thay vì shadow
- [ ] `app/(shell)/coach/trainees/[id]` — chart Recharts dùng `--chart-1` blue mới
- [ ] `app/(shell)/workout/[id]/start` — set log readable, numbers tabular
- [ ] Dark mode (nếu có) — set tokens cho `.dark` variant sau (Lift hiện chỉ có light theme)
- [ ] Mobile viewport — sidebar collapse vẫn ổn
- [ ] Print/PDF export (nếu có cho workout history) — không vỡ

---

## Gotchas

1. **Tailwind v4 syntax** — repo dùng `@theme inline { ... }` (Tailwind v4), KHÔNG phải `tailwind.config.js`. Đừng tạo file config — sửa thẳng `globals.css`.

2. **Font CSS variables** — Lift's globals.css reference `var(--font-geist)` và `var(--font-geist-mono)`. Phải khớp với `variable` field trong `Geist({ variable: "--font-geist" })` ở `layout.tsx`. Đã sync.

3. **Dark mode chưa được port** — Repo có `@custom-variant dark`. Lift system mặc định chỉ có light. Nếu cần dark mode, mình sẽ generate `.dark { ... }` block riêng — yêu cầu mình.

4. **next-themes** — Repo có cài `next-themes`. Sau migration, kiểm tra ThemeProvider không inject conflict colors.

5. **Logo / brand**: Hiện app vẫn tên **YeahBuddy Fitness**. Lift's barbell mark (`/assets/lift-mark.svg`) chưa được wire vào. Nếu muốn dùng, copy vào `public/lift-mark.svg` + import.

---

## Cần mình giúp tiếp?

- ✅ **Apply migration step 1** — bạn copy 2 file, mình ở đây nếu gặp bug.
- 🔧 **Polish step 2** — mình có thể submit PR sửa `card.tsx`, `button.tsx` xóa shadow + add tabular numbers.
- 🎨 **Step 3 pixel-perfect** — mình convert từng screen (Today, Rest timer, Trainer dashboard) thành component Next.js TSX.
- 🌙 **Dark mode** — mình thêm `.dark { ... }` block trong globals.css.
- 📝 **Restyle landing page** — `components/landing/landing-page.tsx` thay nội dung theo Lift voice (sentence case, bỏ emoji, "Log the set. Move on.").

Bạn cho biết muốn đi tiếp hướng nào.
