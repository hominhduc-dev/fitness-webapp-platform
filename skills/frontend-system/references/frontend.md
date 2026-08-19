# YeahBuddy Frontend System Reference

> Source of truth cô đọng cho frontend `fitness-app`. Audit theo code ngày 2026-08-18. Nếu tài liệu lệch code đang chạy, cập nhật tài liệu trong cùng thay đổi.

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc runtime](#2-kiến-trúc-runtime)
3. [Routes và rendering strategy](#3-routes-và-rendering-strategy)
4. [Data flow và state](#4-data-flow-và-state)
5. [Cấu trúc component](#5-cấu-trúc-component)
6. [Design system](#6-design-system)
7. [Theme và liquid glass](#7-theme-và-liquid-glass)
8. [Responsive và mobile](#8-responsive-và-mobile)
9. [Navigation theo role](#9-navigation-theo-role)
10. [i18n, accessibility và PWA](#10-i18n-accessibility-và-pwa)
11. [Muscle map](#11-muscle-map)
12. [Coding và testing conventions](#12-coding-và-testing-conventions)
13. [Yêu cầu → nơi chịu trách nhiệm](#13-yêu-cầu--nơi-chịu-trách-nhiệm)
14. [Checklist thay đổi frontend](#14-checklist-thay-đổi-frontend)

## 1. Tổng quan

### Stack thực tế

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js `16.3.1`, App Router, React `19.2.0` |
| Ngôn ngữ | TypeScript 5, `strict`, alias `@/*` |
| Styling | Tailwind CSS `4.1.9`, CSS variables trong `app/globals.css` |
| UI primitives | shadcn/ui style `new-york`, Radix UI, Vaul drawer |
| Icons | `lucide-react` |
| Charts | Recharts `2.15.4` |
| Date | date-fns `4.1.0` |
| Class composition | `clsx` + `tailwind-merge` qua `cn()` |
| Auth | Supabase Auth, SSR cookie session qua `@supabase/ssr` |
| Visual material | CSS/SVG liquid glass + optional `@ybouane/liquidglass` WebGL |
| Test | Vitest 4 + jsdom + Testing Library |
| PWA/observability | manifest + iOS splash, Vercel Analytics/Speed Insights trên Vercel |

Không có `react-hook-form` hoặc `zod` trong dependency hiện tại. Form phức tạp đang dùng controlled state và validation thủ công; đừng giả định RHF/Zod đã được cài.

### Nguyên tắc hệ thống

- Server Component mặc định; Client Component chỉ ở ranh giới tương tác.
- SSR chịu trách nhiệm auth/role và initial fetch.
- Client gọi Express qua `/backend/*`; server gọi API origin trực tiếp.
- Styling dựa trên semantic tokens, hỗ trợ light/dark cùng một markup.
- Mobile-first; desktop dùng sidebar, mobile dùng floating bottom nav.
- Ba role: `trainee`, `coach`, `admin`.

## 2. Kiến trúc runtime

```text
app/layout.tsx
├─ pre-paint theme + liquid-glass capability probe
├─ Geist / Geist Mono
├─ SVG liquid-glass filters
└─ route tree
   ├─ app/page.tsx                     landing/auth entry
   ├─ app/(shell)/layout.tsx            authenticated application shell
   │  └─ AppProviders
   │     ├─ ThemeProvider
   │     ├─ LocaleProvider
   │     └─ AuthProvider
   │        ├─ SidebarClient            desktop, md+
   │        ├─ ShellHeader              mobile bottom nav + More sheet
   │        ├─ route content
   │        ├─ AIChatBubble             trainee only
   │        └─ ResumeWorkoutCard        trainee only
   ├─ app/workout/*                     focused workout flow
   ├─ app/reset-password/*              public auth flow
   └─ app/dev/*                         isolated component previews
```

### Root layout

- `app/layout.tsx`: metadata, fonts, viewport, iOS splash links, PWA metadata integration.
- Script chạy trước paint đọc `yeahbuddy-theme`, đặt `.dark`, `color-scheme` và `theme-color` để tránh flash.
- Liquid-glass capability probe chỉ bật SVG refraction nâng cao trên Chromium phù hợp.
- `LiquidGlassFilters` cung cấp filter IDs dùng bởi CSS.

### Authenticated shell

- `app/(shell)/layout.tsx` gọi `requireAppUser()` trước render.
- Provider order cố định: Theme → Locale → Auth.
- `main` có mobile bottom padding tính cả safe area; desktop giảm padding.
- Desktop sidebar lazy client-only qua `SidebarClient` để giảm SSR/hydration coupling.

## 3. Routes và rendering strategy

| Route/nhóm | Strategy hiện tại | UI owner chính |
|---|---|---|
| `/` | SSR landing; redirect theo session/role | `components/landing/landing-page.tsx` |
| `/(shell)` | SSR auth shell | `app/(shell)/layout.tsx` |
| `/dashboard` | SSR + Suspense streaming | `components/dashboard/*` |
| `/workout` | SSR + Suspense; fetch collection rồi hydrate board | `components/workout/routines-workout-board.tsx` |
| `/schedule` | SSR + Suspense; fetch workouts rồi hydrate calendar | `components/schedule/weekly-calendar.tsx` |
| `/meals` | SSR auth/fetch → client feature | `components/meals/meals-client.tsx` |
| `/progress` | SSR parallel fetch → client feature/charts | `components/progress/progress-client.tsx` |
| `/trackweight` | route wrapper → lazy client tracker | `components/progress/weight-tracking-*` |
| `/profile` | SSR session/profile fetch → client form | `components/profile-client.tsx` |
| `/coach` | SSR dashboard, coach guard | `app/(shell)/coach/page.tsx` |
| `/coach/trainees*` | SSR guard/fetch → client detail/list | `components/coach/trainee-*` |
| `/coach/programs*` | SSR guard/fetch → client editor/boards | `components/coach/program-*` |
| `/coach/exercises` | SSR fetch → client library | `components/coach/exercise-library-client.tsx` |
| `/coach/find` | trainee SSR fetch → client search | `components/coach/find-coach-client.tsx` |
| `/admin` | SSR admin guard → client console | `components/admin/admin-console.tsx` |
| `/workout/[id]/start` | CSR focused session/logger | `app/workout/[id]/start/page.tsx` |
| `/workout/ai-generate` | CSR generator | `app/workout/ai-generate/page.tsx` |
| `/reset-password` | CSR auth recovery | `app/reset-password/page.tsx` |
| `/dev/muscle-map` | CSR isolated preview | `app/dev/muscle-map/page.tsx` |
| `/dev/design-system` | CSR visual contract lab, không cần session | `app/dev/design-system/page.tsx` |

Route-specific `layout.tsx` files enforce role early bằng `requireAppUser({ role })`. Page cần access token dùng `requireAppSession()`.

### Streaming/loading

- Dùng `Suspense` quanh phần fetch chậm, không quanh toàn shell.
- Route có `loading.tsx` dùng skeleton/shared `PageLoadingState`.
- Skeleton phải gần kích thước layout thật để tránh CLS.

## 4. Data flow và state

### Server → backend

- `getApiBaseUrl()` trả `API_URL_INTERNAL`, fallback `NEXT_PUBLIC_API_URL`, cuối cùng `http://localhost:4000`.
- Server Component lấy access token từ `requireAppSession()` và gọi helper trong `lib/fitness/api.ts`, `lib/admin/api.ts`, `lib/auth/api.ts`.
- Fetch độc lập phải chạy `Promise.all()`.
- Initial data typed được truyền vào client component; không fetch lại ngay sau hydration nếu không cần.

### Browser → backend

- Browser dùng base `/backend`.
- `next.config.mjs` rewrite `/backend/:path*` sang Express origin (`NEXT_PUBLIC_API_URL`, mặc định port 4000).
- Authenticated request gửi `Authorization: Bearer <accessToken>` từ `useAuth().session`.
- GET có thể revalidate; mutation dùng `no-store`.
- Tái sử dụng API helper hiện có, không rải `fetch()` trực tiếp trong component.

### State boundaries

| State | Owner |
|---|---|
| Theme | `ThemeProvider`, localStorage `yeahbuddy-theme` |
| Locale | `LocaleProvider`, cookie `yeahbuddy-locale` |
| Auth session/profile | `AuthProvider`, Supabase browser client |
| Route/filter state | URL/search params khi cần share/back-forward |
| Feature interaction | client component gần nhất |
| Long workout session | `lib/workout/session-storage.ts` + focused workout page |

Không có global Redux/Zustand store. Không thêm global store nếu state chỉ thuộc một feature.

## 5. Cấu trúc component

| Thư mục | Trách nhiệm |
|---|---|
| `components/ui` | Primitive dùng chung: button, input, dialog, drawer, select, tabs, glass filters |
| `components/providers` | Theme, locale, auth và provider composition |
| `components/layout` | Sidebar, mobile nav, account menu, loading shell, theme/language controls |
| `components/dashboard` | Dashboard cards, quick actions, nutrition, recent activity |
| `components/workout` | Routine board/builder, session resume, logs/export |
| `components/schedule` | Weekly calendar và schedule dialogs |
| `components/progress` | Charts, progress calendar, muscle areas, weight tracking |
| `components/meals` | Meal and food tracking experience |
| `components/coach` | Coach dashboards, trainee/program/exercise workflows |
| `components/admin` | Admin console and exercise governance |
| `components/ai` | AI chat/generator UI and structured preview cards |
| `components/body` | Anatomical SVG renderer only |
| `components/auth` | Login/register/recovery modal flows |
| `lib/fitness` | Typed API, domain mapping, muscle profiles, date ranges |
| `lib/i18n/messages` | Copy theo domain, đủ `en` và `vi` |

### Primitive conventions

- Import từ `@/components/ui/*`; không dùng raw Radix trong feature nếu primitive đã tồn tại.
- Dùng `Button` variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.
- Dialog dùng Radix `DialogContent`; drawer dùng Vaul `DrawerContent`; cả hai tự nhận `glass-surface`.
- Dùng `data-slot` cho styling/test ổn định.
- Dùng `cn()` từ `lib/utils.ts` cho conditional classes.

## 6. Design system

### Typography

| Vai trò | Font/pattern |
|---|---|
| UI và headings | Geist, weights 300–700, `font-sans` |
| Số liệu, timer, metadata | Geist Mono, weights 400–600, `font-mono` |
| Micro label | `.label-micro`: Mono 11px, 500, uppercase, tracking `0.08em` |

Heading feature thường dùng 26–36px, weight 600, tracking âm nhẹ. Body dùng semantic `text-foreground`; metadata dùng `text-muted-foreground`.

### Kinetic Glass v2

Nguyên tắc nền tảng: **Color is a role, not decoration**. Component chỉ chọn vai trò (`primary`, `surface`, `success-text`), không tự chọn hue. Cobalt là nhận diện xuyên suốt cả hai theme; dark theme không được thay primary bằng trắng.

### Light palette (`:root`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand-primary` | `#1349ec` | Primary action/accent |
| `--brand-primary-hover` | `#0f3bcc` | Primary hover |
| `--brand-primary-press` | `#0a2fb3` | Primary pressed |
| `--brand-primary-soft` | `#eff3ff` | Active/soft accent |
| `--brand-secondary` | `#22c55e` | Success |
| `--brand-accent` | `#3b82f6` | Info/chart |
| `--ink-0` | `#f4f7fb` | Canvas/background |
| `--ink-50` | `#ffffff` | Card/raised surface |
| `--ink-100` | `#e7eaf0` | Border subtle |
| `--ink-150` | `#d8dde6` | Border/input default |
| `--ink-200` | `#c8cfda` | Border strong/disabled |
| `--ink-400` | `#6b6b6b` | Muted text |
| `--ink-600` | `#525252` | Secondary text |
| `--ink-800` | `#171717` | Foreground |
| `--ink-900` | `#0a0a0a` | Strong display |
| `--ok`, `--ok-text`, `--ok-soft` | `#22c55e`, `#166534`, `#dcfce7` | Success solid/text/soft |
| `--warn`, `--warn-text`, `--warn-soft` | `#f59e0b`, `#92400e`, `#fef3c7` | Warning solid/text/soft |
| `--info-token`, `--info-token-text`, `--info-token-soft` | `#3b82f6`, `#1e40af`, `#dbeafe` | Info solid/text/soft |
| `--danger`, `--danger-text`, `--danger-soft` | `#ef4444`, `#b91c1c`, `#fee2e2` | Destructive solid/text/soft |

Light page backdrop là off-white với blue/green radial tint; không phải nền trắng phẳng.

### Dark palette (`.dark`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand-primary` | `#8facff` | Cobalt primary trên glass tối |
| `--brand-primary-hover` | `#afc2ff` | Primary hover |
| `--brand-primary-press` | `#7596ff` | Primary pressed |
| `--brand-primary-soft` | `rgb(143 172 255 / 16%)` | Active/soft accent |
| `--brand-secondary` | `#5ee0a0` | Success |
| `--brand-accent` | `#89c8ff` | Info |
| `--ink-0` | `#080a0f` | Background |
| `--ink-50` | `rgb(20 24 33 / 78%)` | Raised glass |
| `--ink-100`, `--ink-150`, `--ink-200` | white `10%`, `14%`, `20%` | Border subtle/default/strong |
| `--ink-400` | `#aeb4bf` | Muted text |
| `--ink-600` | `#d0d4dc` | Secondary text |
| `--ink-800` | `#f2f4f8` | Foreground |
| `--ink-900` | `#ffffff` | Strong display |
| `--ok`, `--ok-text`, `--ok-soft` | `#5ee0a0`, `#86efac`, `#052e24` | Success solid/text/soft |
| `--warn`, `--warn-text`, `--warn-soft` | `#fbbf24`, `#fde68a`, `#713f12` | Warning solid/text/soft |
| `--info-token`, `--info-token-text`, `--info-token-soft` | `#89c8ff`, `#bfdbfe`, `#0b2a4a` | Info solid/text/soft |
| `--danger`, `--danger-text`, `--danger-soft` | `#fb7185`, `#fda4af`, `#4c0519` | Destructive solid/text/soft |

Dark backdrop dùng radial cobalt `20%` + green `10%` trên gradient `#10131b → #080a0f → #0b1013`; không dùng solid black hoặc radial đỏ cục bộ.

### Chart palette

| Slot | Light | Dark |
|---|---|---|
| `chart-1` | `#1349ec` | `#8facff` |
| `chart-2` | `#15803d` | `#5ee0a0` |
| `chart-3` | `#b45309` | `#fbbf24` |
| `chart-4` | `#7c3aed` | `#c4b5fd` |
| `chart-5` | `#be185d` | `#fda4af` |

### Semantic token rule

Trong JSX chỉ ưu tiên:

- `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-primary-soft`;
- `text-foreground`, `text-muted-foreground`, `text-primary`;
- `border-border`, `border-input`, `ring-ring`;
- trạng thái dạng chữ: `text-success-text`, `text-warning-text`, `text-info-text`, `text-destructive-text`;
- trạng thái dạng nền: `bg-success`, `bg-warning`, `bg-info`, `bg-destructive`; nền nhẹ dùng hậu tố `-soft`;
- nội dung trên solid status dùng `*-foreground`, ví dụ `bg-success text-success-foreground`;
- context đặc thù đã có contract: `overlay`, `inverse-*`, `export-*`, `chart-*`.

Không dùng `bg-white`, `text-black`, Tailwind hue thô, hex/rgb/hsl hoặc `dark:*` để mô phỏng semantic token đã có. Literal chỉ hợp lệ trong `globals.css`, artwork giải phẫu, filter kỹ thuật hoặc brand asset đã được allowlist. `npm run lint:colors` thực thi contract này và chạy trong CI.

### Contrast contract

- Text thường phải đạt WCAG AA `4.5:1`; UI/icon lớn tối thiểu `3:1`.
- Status text luôn ghép với status soft tương ứng, không dùng solid hue làm chữ trên canvas.
- `lib/design-system/color-contrast.test.ts` đọc trực tiếp token từ `globals.css` và kiểm tra cặp foreground/background của cả hai theme.
- `/dev/design-system` là nơi visual QA palette, controls, statuses và muscle map trước khi rollout component mới.

### Radius, surface và spacing

- Base radius token: `1rem` (16px).
- Form/control primitive thường `rounded-md`.
- Feature cards thường 18–24px; glass card chuẩn 20px.
- Page container phổ biến: `mx-auto w-full max-w-6xl px-4 py-6 md:px-6`.
- Calendar max width 1100px; focused workout max width 2xl; mobile floating controls max width 390px.
- Card spacing phổ biến 16–24px; dense list 8–12px.

## 7. Theme và liquid glass

### Theme lifecycle

- Modes: `light`, `dark`, `system`; default `light`.
- `ThemeProvider` đặt class `.dark` cho mọi theme khác `light`, đặt CSS `color-scheme`, meta `theme-color` và expose `resolvedTheme` (`light | dark`).
- Giá trị `yeahbuddy-theme` cũ (`glass`, `midnight`) được migrate về `dark` ở cả `migrateStoredTheme()` lẫn pre-paint script.
- Root pre-paint script trong `app/layout.tsx` phải luôn ra **cùng kết quả** với `applyThemeToDocument()`: cùng class, cùng `color-scheme`, cùng `theme-color`. Lệch là flash khi reload.
- Thêm theme color literal mới phải allowlist trong `scripts/check-ui-colors.mjs` và thêm case vào `lib/design-system/color-contrast.test.ts`.
- Landing `/` bị ép light trong pre-paint script.
- Khi effect/canvas phụ thuộc theme, dùng `resolvedTheme`, không dùng raw `theme` vì mode `system` có thể đổi.

### Glass layers

| Layer | Cơ chế |
|---|---|
| Fallback mọi browser | CSS gradient + backdrop blur + semantic `--glass-*` tokens |
| Chromium enhancement | SVG `backdrop-filter: url(#...)` khi capability probe pass |
| Mobile nav enhancement | `@ybouane/liquidglass` WebGL qua `useLiquidGlass()` |

Shared classes:

- `.glass-surface`: dialog, drawer, panel/sheet;
- `.glass-card`: content card có hover lift;
- `.glass-inset`: recessed panel bên trong glass;
- `.lg-bevel`: Fresnel/specular rim;
- `.lg-dome`, `.ai-bubble-trigger`: round glass control;
- `.mobile-floating-nav`: mobile navigation pill.

### Glass guardrails

- Luôn giữ CSS fallback; WebGL failure không được chặn navigation.
- `prefers-reduced-transparency: reduce` chuyển sang opaque `--glass-solid`.
- `prefers-reduced-motion: reduce` gần như tắt animation/transition.
- Khi WebGL active, CSS nền của target bị đặt transparent; canvas phải được recreate khi visual dependency đổi.
- `useLiquidGlass(ref, config, renderKey)` dùng `renderKey=resolvedTheme` cho mobile nav để tránh cache theme cũ.
- Không đặt `position: relative` cho `.ai-bubble-trigger`; nó phải giữ `fixed`.

## 8. Responsive và mobile

### Breakpoint chính

- Tailwind mobile-first.
- `md` = 768px là ranh giới shell quan trọng:
  - `< md`: ẩn sidebar, hiển thị floating bottom nav.
  - `md+`: hiển thị sidebar glass, ẩn bottom nav.
- `sm` chủ yếu đổi dialog/action layout; `lg`/`xl` dùng cho dashboard/chart grids.

### Mobile shell

- Bottom nav: fixed, centered, `max-w-[390px]`, 5 cột, safe-area bottom.
- Primary four nav items + nút More; More mở glass sheet chứa toàn bộ navigation/settings.
- Nội dung shell phải có padding bottom để không bị nav che.
- `ResumeWorkoutCard` nằm phía trên bottom nav; AI bubble có rule tránh đè workout chip.

### Touch và safe area

- Dùng `env(safe-area-inset-*)` ở shell, fixed footer, modal footer.
- Touch control mặc định tối thiểu 44px qua `pointer-coarse:*`; chip dense tối thiểu khoảng 40px.
- Input/select/textarea trên iOS có font floor 16px để tránh auto zoom.
- `touch-action: manipulation` trên interactive controls; pinch zoom của trang vẫn bật.
- Dùng `100dvh`/`100svh`, không dựa vào `100vh` cho full-screen mobile.

## 9. Navigation theo role

Nguồn duy nhất: `components/layout/shell-nav.ts`.

| Role | Items |
|---|---|
| Trainee | Dashboard, Schedule, Workout, Meals, Progress, Add Coach |
| Coach | Home, Clients, Programs, Exercises, Stats |
| Admin | Overview, Users, Coach Requests, Connections, Programs, Exercises, Audit, Settings |

- Active matching dùng `isNavItemActive()`; Dashboard/Coach/Admin root cần exact behavior.
- Desktop variants nằm trong `components/layout/sidebar.tsx`.
- Mobile nav/More sheet nằm trong `components/layout/shell-header.tsx`.
- Không hard-code nav item riêng trong page; cập nhật `shell-nav.ts` rồi kiểm tra cả desktop/mobile và role guard.

## 10. i18n, accessibility và PWA

### i18n

- Locales: `en`, `vi`; default hiện tại `en`.
- Client đọc `useLocale()`, server đọc `getServerMessages()`/`getServerLocale()`.
- Messages chia domain trong `lib/i18n/messages/*.ts` rồi merge ở `index.ts`.
- Thêm key phải cập nhật cả `en` và `vi` với cùng shape.
- Locale đổi bằng cookie và `router.refresh()`; `<html lang>` cũng được cập nhật.

### Accessibility

- Dùng Radix primitives cho dialog/focus/keyboard behavior.
- Icon-only control phải có `aria-label`; decorative label dùng `sr-only` khi cần.
- Body map dùng `role="img"`, group label và `data-muscle` cho vùng tương tác.
- Giữ focus ring semantic và keyboard action; không xóa outline mà không thay thế.
- Tôn trọng reduced motion/transparency và cho phép zoom.

### PWA

- `public/manifest.json`: standalone, portrait, shortcuts Workout/Meals/Progress/Schedule.
- `app/layout.tsx`: icons, apple web app, theme color, viewport-fit cover.
- iOS splash assets sinh từ `lib/ios-splash-devices.json` bằng `npm run splash`.
- App icons sinh bằng `npm run icons`.

## 11. Muscle map

### Layer ownership

| Layer | File |
|---|---|
| SVG renderer/front-back | `components/body/muscle-map.tsx`, `muscle-map-pair.tsx` |
| Artwork paths | `components/body/muscle-paths.front.ts`, `.back.ts`, `muscle-outline.ts` |
| Legacy group ↔ slug mapping | `lib/fitness/muscle-map.ts` |
| Primary/secondary profile resolution | `lib/fitness/muscle-profile.ts` |

- Routine/progress highlight phải đi qua `buildMuscleProfileHighlights()` hoặc helper mapping tương ứng.
- Approved explicit profile thắng legacy `muscleGroup`; pending/historical fallback về coarse group.
- Primary color luôn thắng secondary color.
- Không tô decorative slugs như head/hair/hands/feet.
- Pair front/back là presentation mặc định vì một view đơn có thể bỏ sót nhóm cơ.

## 12. Coding và testing conventions

### Component/code

- Named export cho component; Next route/layout/loading là ngoại lệ default export.
- Props/type đặt gần component hoặc domain type file khi dùng chung.
- Dùng dynamic import cho editor/chart/client bundle lớn khi đã có pattern lazy.
- Không expose Supabase service-role key ra client.
- Không duplicate serialized/date mapping; API helper chịu trách nhiệm map `Date`.
- Console chỉ cho `warn`/`error`; ESLint cảnh báo React Compiler legacy rules nhưng không được thêm error mới.

### Forms

- Hiện dùng controlled React state.
- Label phải gắn với input; error copy lấy từ messages nếu hiển thị cho user.
- Mutation có pending/disabled state và giữ lỗi API có thể hành động.
- Chỉ đưa RHF/Zod vào sau quyết định dependency rõ ràng; nếu thêm, cập nhật tài liệu này.

### Tests và validation

| Mục tiêu | Lệnh |
|---|---|
| Lint file đổi | `npx eslint <files>` |
| TypeScript | `npm run typecheck` |
| Unit/component tests | `npm test -- <pattern>` hoặc `npx vitest run <files>` |
| Semantic color contract | `npm run lint:colors` |
| Production integration | `npm run build` |

- Tests frontend nằm trong `components/**/*.test.tsx`, `lib/**/*.test.ts(x)`.
- Với responsive/theme/glass, cần visual test trên mobile và desktop; unit test không xác nhận canvas/CSS rendering.
- `npm run build` có thể cần network cho `next/font` và backend/Supabase-dependent SSR.

## 13. Yêu cầu → nơi chịu trách nhiệm

| Yêu cầu/bug | Đọc đầu tiên | Sau đó nếu cần |
|---|---|---|
| Màu, theme, contrast | `app/globals.css` | `theme-provider.tsx`, `app/layout.tsx` |
| Bottom nav/mobile menu | `components/layout/shell-header.tsx` | `shell-nav.ts`, `use-liquid-glass.ts`, glass CSS |
| Desktop sidebar | `components/layout/sidebar.tsx` | `shell-nav.ts`, sidebar tokens |
| AI bubble | `components/ai/chat-bubble.tsx` | `.ai-bubble-trigger` trong globals |
| Page shell/overlap/fixed UI | `app/(shell)/layout.tsx` | shell header, resume card, globals safe area |
| Dashboard card | `components/dashboard/*` | dashboard page SSR composition |
| Routine cards/filter/map popup | `components/workout/routines-workout-board.tsx` | routine builder, muscle profile helpers |
| Workout session logger | `app/workout/[id]/start/page.tsx` | session storage, workout API/types |
| Schedule/calendar | `components/schedule/weekly-calendar.tsx` | schedule page SSR loader, fitness API |
| Meals | `components/meals/meals-client.tsx` | fitness API/messages |
| Progress/chart | `components/progress/*` | progress page initial fetch, Recharts |
| Coach program editor | `components/coach/program-editor.tsx` | program page, fitness API/types |
| Exercise picker/search | `components/exercises/*` | exercise search/display helpers |
| Muscle highlight sai | `lib/fitness/muscle-profile.ts` | muscle-map mapping, renderer |
| Dialog/drawer/input/button chung | `components/ui/*` | globals glass/data-slot rules |
| Login/session/profile | auth component/provider | `lib/auth/*`, Supabase client/server |
| Copy/ngôn ngữ | domain file trong `lib/i18n/messages` | locale provider/server |
| Metadata/PWA/font | `app/layout.tsx` | manifest, icon/splash scripts |
| API URL/proxy | `lib/supabase/config.ts` | `next.config.mjs`, domain API helper |

## 14. Checklist thay đổi frontend

Trước khi sửa:

- Xác định route, role và server/client boundary.
- Xác định owner theo bảng trên; tránh broad search.
- Kiểm tra primitive/token/message/helper đã tồn tại.

Trong khi sửa:

- Dùng semantic tokens và `cn()`.
- Nếu thêm color role mới: định nghĩa cả light/dark trong `globals.css`, expose qua `@theme inline`, bổ sung contrast pair/test khi có text và cập nhật Design System Lab.
- Giữ light/dark, mobile/desktop, safe area và keyboard behavior.
- Nếu dùng effect/canvas, liệt kê visual dependencies như theme/size.
- Không fetch duplicate hoặc phá SSR initial data.

Sau khi sửa:

- Lint file đổi và typecheck.
- Chạy `npm run lint:colors` và contrast tests.
- Chạy test domain liên quan.
- Visual verify đúng breakpoint/theme nếu là UI bug.
- Cập nhật file này nếu architecture, token, route strategy, shared component hoặc convention thay đổi.
