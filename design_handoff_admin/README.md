# Handoff: Admin console (Lift design)

Reference design for the **admin console** of the Lift / YeahBuddy fitness platform, styled to the Lift system (warm-neutral, hairline borders, electric-blue accent, tabular numbers).

## What this is
The files in `prototype/` are a **runnable design reference** built in HTML + React (Babel-in-browser). Open `prototype/admin.html` in a browser and click through all 7 sections. They are **not** production code — recreate the look & behaviour inside the existing Next.js codebase (`hominhduc-dev/fitness-app`), reusing its shadcn primitives, Lift tokens in `app/globals.css`, and the existing `@/lib/admin/api` data layer.

## Maps to the real app
- Route: `app/(shell)/admin/page.tsx` → `<AdminConsole/>` (`components/admin/admin-console.tsx`).
- Data: `@/lib/admin/api` — `fetchAdminDashboard`, `fetchAdminUsers`, `fetchAdminUserDetail`, `updateAdminUserRequest`, `resetAdminUserPasswordRequest`, `fetchAdminCoachRequests`, `updateAdminCoachRequestStatus`, `fetchAdminConnections`, `assignAdminCoachConnection`, `removeAdminCoachConnection`, `fetchAdminPrograms`, `deleteAdminProgramRequest`, `fetchAdminExercises`, `createAdminExerciseRequest`, `updateAdminExerciseRequest`, `deleteAdminExerciseRequest`, `importAdminExercisesRequest`, `fetchAdminAuditLogs`.
- Types: `@/lib/admin/types` (`AdminDashboardData`, `AdminUserListItem`, `AdminUserDetail`, `AdminCoachRequest`, `AdminConnectionsData`, `AdminProgramSummary`, `AdminExerciseItem`, `AdminAuditLogItem`).

The mock data in `prototype/AdminData.jsx` is shaped after these types so the mapping is 1:1.

## The 7 sections (same IA as the current console)
1. **Dashboard** — 5 stat cards (total users / coaches / trainees / active 7d / active 30d), 3 bar charts (user growth, active users, workout logs) with weekly/monthly toggle, Recent users (click → opens user), At-risk trainees.
2. **Users** — master-detail. Search + role filter; detail panel changes role (trainee/coach/admin), locks/unlocks, manual password reset.
3. **Coach Requests** — approve/reject pending, status filter, sidebar shows pending count badge.
4. **Connections** — assign coach ↔ unassigned trainee, unlink existing.
5. **Programs** — system-wide oversight, delete (with confirm).
6. **Exercises** — library grouped by muscle group (expand/collapse), create/edit/delete (delete blocked when `usageCount > 0`), **Import Excel** dialog (mirrors the exercise template: exercise_name · muscle_group · variation_name · equipment · is_default · sort_order).
7. **Audit** — admin activity log, type filter + search.

## Design spec (Lift — tokens already in app/globals.css)
- Cards/panels: `border border-border`, `rounded-[10px]`, **no shadow**; hover lifts border to `--primary/30`.
- Headings `font-semibold` (never `font-black`); page H1 ~28–34px, `tracking-[-0.02em]`.
- Micro labels (`.label-micro`): mono, 11px, uppercase, `0.08em`, `--muted-foreground`.
- Numbers (stats, counts, dates): `font-mono` + `tnum`.
- Single accent `--primary` (#3a5fff). Charts: bars `--muted` track tone, **last/current bar `--primary`** — no gradient, no teal.
- Role/status pills via `Badge`: admin = primary-soft, coach = success-soft, trainee = neutral; locked/rejected = destructive-soft; pending = warning-soft.
- Sidebar nav (240px, hairline right border) instead of horizontal tabs — admin badge under the wordmark, pending-count badge on "Coach Requests".
- Toast bottom-center on every mutation; 120ms hover / 220ms toast; easing `cubic-bezier(.2,.7,.2,1)`.

## Off-spec in the CURRENT admin-console.tsx (fix list)
The existing console works but breaks Lift rules — bring it in line:
| Current | Fix |
|---|---|
| `rounded-2xl` everywhere | `rounded-[10px]` (cards), `rounded-lg` |
| Pill `rounded-full` filter bars + tab bar `bg-muted/70` | hairline chips / sidebar nav |
| `font-bold` / `text-3xl font-bold` headings | `font-semibold` |
| `bg-primary/10 border-primary/20` "Admin Control Center" gradient-ish pill | flat `--ink-900` admin badge (see prototype sidebar) |
| Chart bars `bg-primary/85` on `bg-muted/40` rounded-xl wells | flat bars, track `--muted`, current bar full `--primary` |
| Mixed `tabular-nums` usage | apply `.tnum` consistently to all numeric cells |

> Keep all i18n (`useLocale().messages`), Supabase wiring, and the rich exercise-import parser in the current console — this handoff changes **look**, not data flow.

## Files
- `prototype/admin.html` — open this to run the reference (loads the JSX below).
- `prototype/AdminApp.jsx` — routing, toast, exercise-import dialog.
- `prototype/AdminSidebar.jsx` — 240px nav + admin badge + pending count (mobile drawer too).
- `prototype/AdminDashboard.jsx` — stats, bar charts, recent/at-risk (exports `AdminHeader` used by all sections).
- `prototype/AdminUsers.jsx` — master-detail users.
- `prototype/AdminExercises.jsx` — grouped library + create/edit modal.
- `prototype/AdminMisc.jsx` — Requests, Connections, Programs, Audit.
- `prototype/AdminData.jsx` — mock data (matches `@/lib/admin/types`).
- `prototype/components.jsx` — shared primitives (Button, Icon, Input, Chip, Tag, Avatar, Label, useIsMobile).
- `prototype/colors_and_type.css` — full Lift token reference (source of truth for values).
- Icons: Lucide (`layout-dashboard, users, user-round-check, link, clipboard-list, dumbbell, scroll-text, shield-check, key-round, lock, lock-open, unlink, pencil, trash-2, upload, upload-cloud, check, search, x, chevron-down/right, arrow-right`).
