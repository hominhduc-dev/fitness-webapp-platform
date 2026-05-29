# PROMPT — Hoàn thiện Program Builder (dán vào Claude Code)

> Dán nguyên khối dưới đây vào Claude Code khi đang mở repo `fitness-app`.
> Yêu cầu: đã copy thư mục `design_handoff_coach/` vào repo trước.

---

Bạn đang làm trong repo **fitness-app** (Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Supabase). Nhiệm vụ: **hoàn thiện giao diện và chức năng của Program Builder** cho coach, theo đúng thiết kế Lift trong bộ handoff, và nối với data layer thật.

## 0. Đọc trước khi code
1. `design_handoff_coach/README.md` — spec tổng thể + danh sách off-spec.
2. `design_handoff_coach/prototype/ProgramBuilder.jsx` và `RoutineBuilder.jsx` — **đây là spec UX/tương tác chuẩn** (prototype React chạy được; mở `prototype/coach-prototype.html` → New program để xem).
3. `components/coach/program-editor.tsx` — builder hiện tại trong repo. Quyết định: refactor nó theo prototype, HAY thay bằng implementation mới. Giữ nguyên mọi logic lưu/Supabase đang hoạt động.
4. `app/(shell)/coach/programs/new/page.tsx` và `app/(shell)/coach/programs/[id]/page.tsx` — route gắn builder. `[id]` truyền `programId`, `initialExerciseOptions`, `initialTraineeOptions`.
5. `lib/fitness/api.ts` + `lib/fitness/types.ts` — data layer + kiểu.

## 1. Data model thật (BẮT BUỘC bám theo)
Program Builder lưu qua `CreateCoachProgramInput`:
```ts
type CreateCoachProgramInput = {
  name: string
  description?: string
  difficulty: "beginner" | "intermediate" | "advanced"   // dùng đúng enum của Program["difficulty"]
  duration: number                       // số tuần
  assignToUserIds?: string[]
  workouts: Array<{
    name: string
    duration?: number
    scheduledDay?: number                // 0..6 (thứ trong tuần) — KÊNH map vào lưới ngày
    scheduledDate?: string               // "YYYY-MM-DD" (tùy chọn)
    exercises: Array<{
      variationId: string                // id của ExerciseVariationOption
      sets: number
      reps: number
      repsMin?: number
      weight?: number
    }>
  }>
}
```
- API: `createCoachProgram(token, input)`, `updateCoachProgram(token, id, input)`, `fetchCoachProgram(token, id)` (load đầy đủ workouts để edit), `fetchCoachTrainees(token)`, `fetchExercises(token, opts)` / `fetchExerciseLibrary(token)` cho danh sách bài tập.
- Token lấy bằng `useAuth().session.access_token` (xem pattern ở `components/coach/pending-requests-panel.tsx`).
- **Lưu ý mô hình:** prototype có khái niệm "routine" thả vào ô ngày. Trong app thật, **một workout chính là buổi tập của một ngày** (`scheduledDay`). Ánh xạ: mỗi ô ngày được điền = một entry trong `workouts[]` với `scheduledDay = index ngày`. "Routine builder" của prototype = trình thêm bài tập (exercises) cho buổi đó.

## 2. Checklist tính năng (theo prototype, phải có đủ)
- [ ] Meta: input **tên**, **mô tả**, `Select` **số tuần** (4/6/8/10/12/16), `Select` **days/week** (3–6), `Select` **difficulty**.
- [ ] **Lưới tuần**: thanh chọn tuần `w1…wN`; tuần active làm nổi; mỗi chip có chấm "đã đầy" khi mọi buổi trong tuần được điền.
- [ ] **Lưới 7 ngày** cho tuần đang chọn: ô buổi tập (điền = tên buổi + tag/màu + số bài), ô trống (`+`), ô nghỉ (dashed + "Rest"). Click ô trống/điền → mở picker; hover → cho phép chuyển thành ngày nghỉ.
- [ ] **Picker buổi tập**: chọn từ workout/template có sẵn HOẶC **"Create new routine"** → mở trình tạo buổi (tên + tag + danh sách bài tập với sets/reps/kg, reorder ↑/↓, xoá; thêm bài qua exercise picker lọc theo nhóm cơ dùng `fetchExercises`). Lưu xong: thêm vào thư viện tạm **và** thả ngay vào ô vừa mở.
- [ ] **Copy week to all**: nhân bản tuần đang chọn sang các tuần còn lại.
- [ ] **Thanh hoàn thành** (filled/total sessions), %, đổi màu khi 100%.
- [ ] **Save**: disabled tới khi có tên + ≥1 buổi được điền. New → `createCoachProgram`; edit → `updateCoachProgram`. Sau khi lưu, `router.push('/coach/programs')` hoặc refresh.
- [ ] (Tùy chọn) gán client ngay khi tạo qua `assignToUserIds`.

## 3. BẪY phải tránh (prototype từng dính)
- **Khởi tạo lịch theo độ dài thật của chương trình**, không hardcode 8 tuần. Khi edit chương trình N tuần mà mảng `schedule` chỉ 8 phần tử → `schedule[i]` undefined → `.filter` crash → trắng trang. Dùng `makeEmptySchedule(initial?.duration ?? 8, daysPerWeek)` và regenerate khi đổi tuần/ngày (giữ lại ô đã điền nếu còn nằm trong phạm vi mới).
- Khi đổi số tuần xuống thấp hơn `activeWeek` → kẹp `activeWeek` về `newWeeks - 1`.
- Map ngược khi **edit**: từ `program.workouts` (mỗi workout có `scheduledDay`, `exercises[].variation.id`, `exercises[].sets[]`) dựng lại lưới. Suy `sets = exercise.sets.length`, `reps = sets[0].targetReps`, `repsMin = sets[0].targetRepsMin`, `weight = sets[0].weight`.

## 4. Spec thiết kế (Lift — token đã có trong app/globals.css)
- shadcn: `Dialog`, `Select`, `Input`, `Button`, `Badge`, `Checkbox`, `DropdownMenu`. **Không** thêm dependency mới.
- Card/modal: `rounded-[10px]` (modal có thể `rounded-[14px]`), `border border-border`, **không shadow** trên card (modal dùng shadow của `DialogContent` là OK), padding rộng (20–28px).
- Heading `font-semibold` (KHÔNG `font-black`); nhãn nhỏ dùng class `.label-micro`; số dùng `font-mono tnum`.
- Accent **chỉ** `--primary` (#3a5fff). Không gradient, không màu teal.
- Tag nhóm buổi (push/pull/legs/upper/lower/full) mỗi loại một chấm màu nhỏ — giữ bảng màu như `tagDotPB` trong prototype, nhưng ưu tiên token semantic của repo.
- Transition 120ms hover / 180ms panel; easing `cubic-bezier(.2,.7,.2,1)`; không scale-on-press.
- Copy: sentence case, không emoji. Có thể i18n qua `useLocale().messages` (component là client nên dùng được).

## 5. Tiêu chí nghiệm thu
1. Tạo chương trình mới: điền meta → điền buổi cho vài ngày → tạo routine mới inline → Save → xuất hiện trong `/coach/programs` (đã chạy qua `createCoachProgram`).
2. Mở Edit một chương trình **12 tuần** không crash; lưới hiện đủ 12 tuần với buổi đã có.
3. Đổi số tuần/ngày không mất dữ liệu ô còn hợp lệ; "Copy week to all" hoạt động.
4. Giao diện đạt spec Lift (hairline, không gradient/shadow thừa, số tabular, accent xanh).
5. Không phá i18n/Supabase/route hiện có; `npm run build` pass, không lỗi type.

Làm theo thứ tự: đọc file ở mục 0 → chốt refactor hay rebuild → dựng UI theo checklist → nối API mục 1 → test theo mục 5. Hỏi lại tôi nếu mô hình workout↔routine trong repo khác giả định ở mục 1.
