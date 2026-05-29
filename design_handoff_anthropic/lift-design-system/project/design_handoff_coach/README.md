# Handoff: Coach experience (Lift design)

## Overview
This package hands off the **Coach (trainer) side** of the Lift design — the dashboard/roster, the Programs list, the multi-week Program Builder, the Routine Builder, and the Assign-to-client flow — for implementation in the existing **YeahBuddy / fitness-app** codebase (`hominhduc-dev/fitness-app`).

The goal: bring the coach screens up to the Lift visual spec (warm-neutral, hairline-driven, electric-blue accent, tabular numbers) **and** add the interaction patterns the current coach area is missing (card kebab menu, inline assign modal, week-grid program builder, in-context routine creation).

## About the design files
The files in `prototype/` are **design references built in HTML + React (Babel-in-browser)** — they show intended look and behavior. They are **not** production code to copy verbatim. The task is to **recreate these designs inside the existing Next.js 16 / React 19 / Tailwind v4 / shadcn-ui codebase**, reusing its established patterns:
- Use the existing shadcn primitives (`Button`, `Badge`, `Avatar`, `Dialog`, `DropdownMenu`, `Input`, `Select`, `Checkbox`, `Progress`).
- Use the already-applied Lift design tokens in `app/globals.css` (`--primary`, `--background`, `--border`, `.label-micro`, `.tnum`) — do **not** reintroduce raw hex.
- Wire to the existing data layer (`fetchCoachDashboard`, `fetchCoachPrograms` in `@/lib/fitness/api`, `requireAppSession`), not the prototype's mock arrays.
- Keep i18n (`useLocale().messages`) for all copy.

Open `prototype/coach-prototype.html` in a browser to interact with the reference (program cards → kebab menu, Edit, Assign; New program → week grid → Create new routine).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and interactions are final. Recreate pixel-faithfully using the codebase's shadcn components + Lift tokens. The prototype's mock data is illustrative only.

---

## What's off-spec today (fix list)

The current coach area already uses Lift tokens but several pieces break the Lift rules. Highest-impact fixes:

### `app/(shell)/coach/page.tsx` — coach dashboard (most off-spec)
| Current | Problem vs Lift | Fix |
|---|---|---|
| Hero `bg-[linear-gradient(135deg,…teal…)]` | **No gradients anywhere** in Lift | Flat surface: `bg-card border border-border`, or `bg-foreground text-background` for one dark hero band — no gradient |
| `shadow-[0_24px_80px…]`, `shadow-sm` on cards | **No shadows on cards** — hairlines do the work | Remove all `shadow-*` from cards; keep `border border-border` |
| `rounded-[28px]` | Card radius caps at **10px** (`--r-4`) | `rounded-[10px]` (or `rounded-lg` = `var(--radius)`) |
| `font-black` headings | Lift maxes at **600** (semibold); hierarchy via scale, not weight | `font-semibold`, larger sizes |
| Bar chart `bg-[linear-gradient(180deg,#0f766e,#14b8a6)]` (teal) | Charts use **flat `--primary` (electric blue)** over `--muted` tracks; teal is off-palette | Track `bg-muted`, bars `bg-primary`; today's bar may use full `--primary`, rest `--foreground` |
| Mixed teal/cyan accent | Single accent is **`#3a5fff`** | Use `text-primary` / `bg-primary` only |

After these, the dashboard should match the prototype's `TrainerApp` roster + chart (`prototype/TrainerApp.jsx`).

### `app/(shell)/coach/programs/page.tsx` — programs list
- `rounded-xl` → `rounded-[10px]`; `font-bold` → `font-semibold`.
- Difficulty badge currently maps to `secondary`/`accent` token colors (both are the blue accent-soft) → use `badge` `micro` variant or distinct muted tones.
- **Missing interactions** to add (see Screens below): per-card **kebab menu** (Edit / Assign / Duplicate / Delete) and an inline **Assign-clients modal**. Today the card only has a single "View Details" link.

---

## Screens / Views

### 1. Coach Dashboard — roster + activity
**Reference:** `prototype/TrainerApp.jsx` (the `TrainerApp`, `TrainerSidebar`, `ClientList`, `ClientDetail`, weekly bar chart).
**Maps to:** `app/(shell)/coach/page.tsx` (+ `app/(shell)/coach/trainees/page.tsx`, `…/[id]/page.tsx`).
**Data:** `fetchCoachDashboard(accessToken)` → `{ summary, activityByDay[], pendingRequests, recentWorkoutLogs[], atRiskTrainees[], trainees[] }`.

**Purpose:** coach scans all trainees, opens one to see weekly volume, key lifts, recent sessions.

**Layout:**
- Desktop: fixed **240px** sidebar (`border-right: 1px solid --border`) + content. Optional split `360px` roster column + detail (prototype `ClientList | ClientDetail`).
- Stat row: 4 cards, `grid md:grid-cols-2 xl:grid-cols-4`, each `border border-border rounded-[10px] p-4` **no shadow** — your existing `StatsCard` is already correct, reuse it.
- 7-day chart card: `border border-border rounded-[10px] p-5`; bars in a `grid-cols-7`, height ∝ value, **flat `--primary`**, track `--muted`, today's bar `--primary`, others `--foreground`. Day labels: `.label-micro`.

**Components & tokens:**
- Card: `background var(--card)`, `1px solid var(--border)`, radius **10px**, padding **20px**, **no shadow**, hover `border-color → color-mix(--primary 25%)`.
- Headings: `font-semibold`, `letter-spacing -0.02em`. Page H1 ~`28–36px`.
- Micro labels ("THIS WEEK · SETS PER DAY", "VS PLAN: 28"): `.label-micro` (mono, 11px, `0.08em`, uppercase, `--muted-foreground`).
- Numbers (volume, %, streak): `font-mono tnum`.
- Status dot: `--success` on-track, `--warning` behind, `--muted-foreground` rest. Status pill uses `Badge`.
- Avatar stacks: `-space-x-2`, `border-2 border-card`.

**Interactions:** click roster row → load detail (active row `bg-muted`, `border-left 3px --primary`). Buttons: "Message" (`outline`), "Assign workout" (`default`).

### 2. Programs list
**Reference:** `prototype/ProgramsScreen.jsx`.
**Maps to:** `app/(shell)/coach/programs/page.tsx`.
**Data:** `fetchCoachPrograms(accessToken)` → `[{ id, name, description, difficulty, duration, workoutsPerWeek, workouts[], assignedTrainees[], createdAt }]`.

**Purpose:** grid of authored programs; create / edit / duplicate / delete / assign.

**Layout:** header (`Label` "Programs" + H1 "{n} authored." + mono sub-stat) and "New program" button (`default`, icon `plus`). Card grid: `grid` `repeat(auto-fill, minmax(320px, 1fr))`, `gap 14px`.

**Card components (each program):**
- Title `17px/600`; meta `{duration} weeks · {workoutsPerWeek} days/week` in `.label-micro`.
- **Kebab** (top-right): `Button` `ghost icon-sm`, `more-horizontal`. Opens a **`DropdownMenu`** with: **Edit program** (`edit-3`), **Assign** (`user-plus`), **Duplicate** (`copy`), **Delete** (`trash-2`, `text-destructive`, separated). — *new vs current code.*
- Description: `13px --muted-foreground`, 2-line clamp.
- Assigned strip: `bg-muted rounded-md p-2.5`; avatar stack + "{n} active clients" (mono) or "Not assigned yet" (`.label-micro`).
- Footer actions: **Assign** (`default`, flex-1, `user-plus`) + **Edit** (`outline`, `edit-3`). "Edited {date}" in `.label-micro`.

**State:** `programs[]`, `mode: null|'new'|'edit'`, `editing`, `assignTarget`. Duplicate inserts a copy (`name + " (copy)"`, cleared assignments) after the original. Delete confirms then removes.

### 3. Program Builder (modal)
**Reference:** `prototype/ProgramBuilder.jsx`.
**Maps to:** `app/(shell)/coach/programs/new/page.tsx` and `…/[id]/page.tsx` (currently `components/coach/program-editor.tsx`). Use this as the **UX spec** for that editor; keep your existing save/Supabase logic.

**Purpose:** set length (weeks) + days/week, then drop a routine into each session slot, week by week.

**Layout (modal, max-width 880, `--r-4`, `--shadow-3`):**
1. Header: `Label` (New/Edit program), live title, mono sub-stat `{weeks} weeks · {days}/week · {filled}/{total} sessions filled`, close `x`.
2. Meta inputs: name `Input`, weeks `Select` (4/6/8/10/12/16), days/week `Select` (3–6), description `Input`.
3. Week selector bar (`bg-muted`): one chip per week (`w1…wN`); active = `bg-foreground text-background`; each chip has a fill dot (`--success` when week complete). "Copy w{n} to all" `ghost` button.
4. Session grid: `grid-cols-7` (mobile `grid-cols-2`). Each **SessionSlot** `min-h-[100px]`, `--r-3`: filled = solid border + routine name + tag dot; empty workout = `+`; rest day = dashed border + "Rest". Click empty→open Routine picker; click filled→swap; hover `x`→toggle rest.
5. Footer: completion progress bar (`--primary`, `--success` at 100%), Cancel (`ghost`) + Save (`default`, disabled until name + ≥1 filled slot).

> **Critical bug to avoid (already fixed in this prototype):** initialize the schedule array from the program's **own** `weeks`/`daysPerWeek`, never a hardcoded 8. A length mismatch makes `schedule[i].filter` throw on edit. See `makeEmptySchedule(initial?.weeks, initial?.daysPerWeek)` in the reference.

### 4. Routine picker + Routine Builder (modal-in-modal)
**Reference:** `RoutinePicker` in `prototype/ProgramBuilder.jsx` + `prototype/RoutineBuilder.jsx`.
**Maps to:** routine selection inside the program editor; ties to your exercise library (`components/exercises/exercise-picker.tsx`, `fetchCoachExercises`).

- **Routine picker:** searchable list of routines (tag dot + name + "{tag} · {n} exercises"). Footer **"Create new routine"** → opens Routine Builder; on save, the new routine is added to the library **and** dropped straight into the slot that opened the picker.
- **Routine Builder:** name + tag chips (push/pull/legs/upper/lower/full, each with a color dot), exercise list with reorder (↑/↓), remove (`trash-2`), and Sets/Reps/kg number fields per exercise; "Add exercise" opens an exercise picker filtered by muscle. Save disabled until name + ≥1 exercise.

### 5. Assign-to-clients modal
**Reference:** `AssignClientsModal` in `prototype/ProgramsScreen.jsx` (and `prototype/AssignWorkoutModal.jsx` for the client-side "assign routine vs full program + start date + note" variant).
**Maps to:** assignment action on a program card / trainee detail; writes to your program-assignment table.

- Searchable client roster, multi-select checkboxes (checked = `bg-primary` check). Pre-checks clients already assigned. Footer "{n} selected" + "Assign {n}" (`default`). On save, update `assignedTrainees`.

---

## Interactions & behavior (summary)
- **Transitions:** 120ms color/hover, 180ms panel/menu, 280ms modal enter. Easing `cubic-bezier(.2,.7,.2,1)`. No bounce, no scale-on-press.
- **Hover:** rows/ghost buttons `transparent → --muted`; primary buttons darken via `hover:bg-primary/90`.
- **Modals:** backdrop `rgba(13,13,11,0.45)` + `blur(4px)`; Esc closes; click-outside closes; inner stops propagation. Use your shadcn `Dialog` for these.
- **Dropdown:** closes on outside-click and Esc (use shadcn `DropdownMenu`).
- **Disabled:** 40% opacity, `cursor: not-allowed`.
- **Toast** on assign success: bottom-center, `--ink-900` bg, `check` icon, auto-dismiss ~3.5s.

## State management
- Dashboard: server components + `Suspense` (as today). Detail selection client-side.
- Programs: `programs[]`, `mode`, `editing`, `assignTarget` (client component island over server-fetched data).
- ProgramBuilder: `name, description, weeks, daysPerWeek, schedule[week][day], activeWeek, pickerSlot, library, creatingRoutine`.
- RoutineBuilder: `name, tag, exercises[{name,muscle,equipment,targetSets,targetReps,targetKg}], showPicker`.

## Design tokens (already in `app/globals.css`)
- Accent `--primary #3a5fff` (hover `#2a4ff0`); bg `--background #fcfcfa`; fg `--foreground #1a1a17`.
- Border `--border #ebebe6`; input `--input #e0e0db`; muted surface `--muted #f5f5f1`; `--muted-foreground #4a4a44`.
- Semantic `--success #2a8a5f`, `--warning #b56a1a`, `--destructive #c0341a`.
- Radius `--radius 0.625rem` (sm 6 / md 8 / lg 10 / xl 14). Cards = lg (10px).
- Fonts: Geist (`--font-sans`), Geist Mono (`--font-mono`); numbers `.tnum`; tags `.label-micro` / Badge `micro`.
- Charts: `--chart-1 #3a5fff` … `--chart-5`. Use accent + ink ramp; **no multi-hue, no gradient**.

## Assets
- `prototype/assets/lift-mark.svg` — barbell mark (monochrome, `currentColor`). Brand decision: the app is still "YeahBuddy"; only swap the mark if you intend to rebrand to Lift.
- Icons: **Lucide** (`lucide-react`) — `users, list-checks, calendar, message-square, bar-chart-3, plus, more-horizontal, edit-3, user-plus, copy, trash-2, check, search, x, chevron-*, dumbbell`.

## Files in this bundle
- `prototype/coach-prototype.html` — open this to run the reference.
- `prototype/TrainerApp.jsx` — dashboard / roster / client detail / weekly chart.
- `prototype/ProgramsScreen.jsx` — programs grid, kebab menu, Assign-clients modal.
- `prototype/ProgramBuilder.jsx` — week-grid builder + routine picker.
- `prototype/RoutineBuilder.jsx` — routine + exercise builder.
- `prototype/AssignWorkoutModal.jsx` — client-side assign (routine vs program + date + note).
- `prototype/components.jsx` — shared primitives (`Button`, `Icon`, `Input`, `Chip`, `Tag`, `Avatar`, `Label`, `useIsMobile`).
- `prototype/colors_and_type.css` — full Lift token reference (source of truth for values).
