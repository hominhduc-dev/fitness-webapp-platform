# Handoff: Lift Design Redesign for YeahBuddy Fitness

> **Target repo**: [hominhduc-dev/fitness-app](https://github.com/hominhduc-dev/fitness-app) (Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · Supabase)
> **Goal**: Migrate the app's visual identity from the existing "FitDash blue SaaS" look to the **Lift** design system — a warm-minimal, hairline-driven, data-first aesthetic.

---

## Overview

The existing **YeahBuddy Fitness** app uses a cool-blue SaaS palette (`#1349ec` primary on `#f8fafc` cool-gray background, `0.75rem` radius, Inter font). The user wants to swap this for **Lift** — a minimal warm-neutral design system designed for serious lifters who want to log a set fast and move on.

**Lift's identity**:
- **Warm paper-white** background (`#fcfcfa`) with near-black warm text (`#1a1a17`)
- **One** electric blue accent (`#3a5fff`) used sparingly — only on the active set, primary CTA, focus rings, today's date, and current chart line
- **Hairlines do the work of shadows** — `1px solid #ebebe6` borders, no card shadows
- **Geist** sans + **Geist Mono** for tabular numerics (kg, reps, timers)
- **Tight corner radii** (4/6/10/14 px — no big squircles)
- **Coach-y but minimal voice** — "Today — Push day." not "Welcome back, hero! 💪"
- **No emoji**, no gradients, no hand-illustrated SVGs

---

## About the Design Files

**The files in `design_refs/` are design references created in HTML/JSX with React loaded via CDN + Babel. They are NOT production code to copy directly.**

They are interactive prototypes showing the intended look, behavior, and component composition. Your task is to **apply this design to the existing fitness-app codebase using its established patterns** — Tailwind v4 utility classes, shadcn/ui primitives, Radix components, Recharts for graphs, lucide-react for icons, Supabase for auth.

Inline styles in the JSX prototypes are for the prototype only. In the real app, prefer Tailwind classes + the shadcn variant system.

---

## Fidelity

**High-fidelity (hifi).** All colors, typography sizes, spacing values, border radii, and interaction states are final. Recreate the look pixel-precisely using the codebase's existing libraries.

The screens in `design_refs/ui_kit/` are the visual contract; the existing routes in `app/(shell)/` are the structural contract. Marry the two.

---

## Migration strategy — DO THIS IN ORDER

### Step 1: Drop in tokens + fonts (changes 90% of the UI)

The repo already uses **shadcn/ui with CSS variables** (`--background`, `--primary`, `--border`, `--card`, …). Because of this, **simply swapping the token values in `app/globals.css` propagates the new design to every Button, Card, Dialog, Sidebar, Form, Chart, Sheet, etc — without touching component files**.

Copy these two files from `migration/` to the corresponding paths in fitness-app:

```bash
cp design_handoff_lift_redesign/migration/app/globals.css ./app/globals.css
cp design_handoff_lift_redesign/migration/app/layout.tsx  ./app/layout.tsx
```

These do three things:
1. Replace all token values in `:root` (preserving variable names so existing components keep working).
2. Add `--font-geist` and `--font-geist-mono` CSS variables wired through Tailwind v4's `@theme inline`.
3. Swap the `Inter` import in `app/layout.tsx` for `Geist` + `Geist_Mono` from `next/font/google`.

**Commit message convention** (per repo's CLAUDE.md, Conventional Commits):
```
feat(design): swap to Lift warm-minimal tokens + Geist fonts

- Replace FitDash blue SaaS palette with warm neutrals
- Add Geist + Geist Mono via next/font/google
- Tighten --radius from 0.75rem to 0.625rem
- Desaturate semantic colors (success/warning/destructive)
- Adjust chart palette to use accent + ink-ramp
```

**Suggested branch**: `feat/lift-design-tokens`

---

### Step 2: Polish shadcn primitives (remove shadows, tabular numbers)

After Step 1, certain shadcn components still carry artifacts from the `new-york` style that conflict with Lift's hairline aesthetic:

**`components/ui/card.tsx`** — remove `shadow-sm`:
```diff
- className="rounded-lg border bg-card text-card-foreground shadow-sm"
+ className="rounded-lg border bg-card text-card-foreground"
```

**`components/ui/button.tsx`** — remove `shadow` from the default variant:
```diff
- "bg-primary text-primary-foreground shadow hover:bg-primary/90"
+ "bg-primary text-primary-foreground hover:bg-primary/90"
```

**`components/ui/dialog.tsx`, `components/ui/sheet.tsx`** — keep their shadows (modal-only, per Lift's shadow rules). Verify the backdrop uses `rgba(13,13,11,0.45)` blur(4px) — Lift's specific modal overlay.

**`components/ui/input.tsx`** — verify focus state:
- Border: `var(--ring)` (the new `#3a5fff`)
- Halo: `0 0 0 3px var(--secondary)` (the new `#eaeeff` accent-soft)
- No drop shadow on input itself

**`components/ui/badge.tsx`** — for uppercase status tags (PR, COMPLETE, WARM-UP), use this pattern:
```tsx
className="font-mono text-[11px] uppercase tracking-[0.08em] font-medium px-1.5 py-0.5 rounded-sm"
```

**Anywhere displaying numbers** — kg, reps, weight, calories, macros, timer countdowns — add the `tnum` class or `font-mono`:
```tsx
<span className="text-2xl font-semibold tnum">{weight}</span>
<span className="ml-1 text-sm text-muted-foreground">kg</span>
```

The `tnum` class is defined in the new `globals.css`:
```css
.tnum { font-feature-settings: "tnum" 1, "lnum" 1; }
```

---

### Step 3: Apply pixel-perfect screens (per route)

The prototypes in `design_refs/ui_kit/` map to existing routes in `app/(shell)/`. For each, recreate the layout using shadcn primitives + Tailwind, NOT by literally porting the JSX.

#### Route mapping

| Prototype file | Target Next.js route | Notes |
|---|---|---|
| `landing.html` + `Landing.jsx` | `app/page.tsx` + `components/landing/landing-page.tsx` | Restyle existing landing — see Step 4 |
| `index.html` + `TodayScreen.jsx` | `app/(shell)/workout/[id]/start/page.tsx` | Active workout session — see "Active Workout" section below |
| `RestTimer.jsx` | Floating component inside workout session | Sticky bottom blur footer |
| `HistoryScreen.jsx` | `app/(shell)/progress/` or similar | Monthly calendar + recent sessions |
| `LibraryScreen.jsx` | `app/(shell)/coach/exercises/` or `app/(shell)/workout/exercises/` | Searchable exercise list |
| `PRsScreen.jsx` | Likely under `app/(shell)/progress/` | PR cards with sparklines |
| `BodyScreen.jsx` | `app/(shell)/trackweight/` | Body weight chart + measurements |
| `trainer.html` + `TrainerApp.jsx` | `app/(shell)/coach/trainees/` + `[id]/page.tsx` | Coach roster + per-client detail |

**General conversion rules**:
- Convert each `.jsx` to `.tsx`. Inline styles → Tailwind classes where possible (keep inline styles for one-off precise spacing).
- Use shadcn `<Button>`, `<Card>`, `<Input>`, `<Badge>`, `<Avatar>`, `<Dialog>`, `<Sheet>`, `<DropdownMenu>` instead of the JSX prototype's custom atoms.
- Use `lucide-react` named imports for icons (the kit references `dumbbell`, `calendar`, `flame`, `ruler`, `timer`, `bar-chart-3`, `plus`, `check`, `more-horizontal`, `chevron-right`, `chevron-left`, `search`, `x`, `play`, `users`, `list-checks`, `message-square`, `sticky-note`, `list`).
- Use **Recharts** (already installed) for charts. Lift's chart rule: 1px hairline grid (`stroke="var(--border)"`), 1.75px stroke for lines in `var(--chart-1)` (`var(--primary)`), 4px endpoint dot. No fills, no tooltips with shadow.
- Mobile responsive: Tailwind breakpoints `md:` and below. The prototype's `useIsMobile()` corresponds to `< 768px` — match Tailwind's `md` breakpoint logic.

---

## Detailed screen specs

### Active Workout (TodayScreen → `workout/[id]/start`)

This is the **signature screen** — the rest of the app supports this moment.

**Layout** (desktop, `≥ 768px`):
- Page container: `max-w-[880px] mx-auto px-10 pt-8 pb-30`
- Page header block (`mb-7`):
  - Date label: `Wednesday · March 19` — using `.label-micro` (uppercase mono 11px tracked 0.08em, color `muted-foreground`)
  - H1: `Today — Push day.` — `text-[40px] font-semibold tracking-[-0.02em] text-foreground`
- Session stats card: 4-column grid with hairline dividers (`border-r border-border` on each column except last), no inner gap, `rounded-lg border bg-card mb-7`. Cells are 4 items: Started · Sets · Volume · Exercises.
  - Each cell: 16px×20px padding, uppercase mono micro label, big tabular number (24px / mono / 500), tiny subtitle in muted.
- Exercise blocks (one per exercise, `mb-4`):
  - Top bar: exercise name (`text-lg font-semibold`) + working-set count subtitle + `more-horizontal` icon button on the right
  - Column header row: 6 columns — `Set | Type | Previous | kg | Reps | (check)` — uppercase mono 10px micro labels
  - Set rows: 6-col grid, 10px×16px padding, hairline bottom border. Completed rows: `bg-muted` (the new `#f5f5f1`). Active row: highlighted with `accent`-colored "work" tag.
  - Add set button at bottom of block: full width, transparent, left-aligned, `text-accent` (the new `#3a5fff`), with `plus` icon
- Bottom action bar: `Add exercise` (secondary) + `Cancel` (ghost) + `Finish workout` (dark — `bg-foreground text-background`)

**Layout** (mobile, `< 768px`):
- Padding: `px-4 pt-5 pb-30`
- H1 shrinks to 28px
- Stats grid: 2 columns × 2 rows with hairline dividers
- Set row grid drops the "Previous" column: `Set | Type | kg | Reps | (check)` — 5 columns
- Action buttons stack vertically, full-width

**Set row behavior**:
- Tap the empty checkbox → set marks complete: row background fades to `bg-muted` over 180ms, checkbox fills `bg-success` (`#2a8a5f`) with white check icon, kg/reps text shifts to `muted-foreground` and gets line-through.
- Completing a set fires the **Rest Timer** overlay (see below).
- Tapping a completed checkbox un-completes it.

**Rest Timer overlay** (`RestTimer.jsx`):
- Position: `fixed bottom-6 left-[280px] right-10` on desktop (left offset = sidebar width), `fixed bottom-20 left-3 right-3` on mobile (above bottom nav).
- Background: `bg-background/85 backdrop-blur-xl` (the **one** place in the system that uses transparency + blur)
- Border: `1px solid var(--border)`, `rounded-xl`, modal shadow (`shadow-3` in the system)
- Content: countdown timer (`mm:ss` in 30px mono accent-colored), progress bar (4px height, `bg-border` track, `bg-accent` fill), "After: {exercise} · {kg} × {reps}" caption, `+30s` button (outline), `Skip` button (ghost danger)
- Auto-dismisses when countdown hits 0 (demo prototype uses 30s; production should default to 90s or pull from user setting).

### Trainer Dashboard (TrainerApp → `coach/trainees/`)

**Three-pane layout** on desktop (`≥ 1024px`):
1. **Trainer sidebar** (240px, sticky, full height) — brand mark + "COACH" badge + "← Back to athlete view" link + dark "Add client" button + nav: `Clients (12)` · `Programs (6)` · `Schedule` · `Messages (•)` · `Stats` + avatar/name at bottom.
2. **Client list pane** (360px, scrollable, right-bordered) — `h1 Clients` + search input + chip filters (All / On track / Behind / Rest) + scrollable list of clients. Each row: avatar (36px) + name + status dot + program/last-seen mono caption + chevron. Selected row gets a 3px left border in `accent` and `bg-muted` fill.
3. **Client detail pane** (flex-1, scrollable) — large avatar + program label + name + status tag + "{N}-day streak · last seen X". Coach note in a `bg-muted` card with `sticky-note` icon. Weekly bar chart (sets per day, 7 bars, today's bar in `accent`, others in `foreground` near-black). 3 key-lift cards. Recent sessions table.

**Mobile** (`< 768px`):
- Stack: top bar with brand + COACH badge + avatar → list view → tap client → detail view (with back button)
- No sidebar; nav lives in a sheet (use `<Sheet>` from shadcn if needed)

### Landing page (Landing → `app/page.tsx`)

Restyle the existing `components/landing/landing-page.tsx`:
- Hero headline: `Log the set. / Move on.` (second line in `muted-foreground`)
- Big bold: 84px on desktop, 44px mobile, `tracking-[-0.035em]`, `leading-[0.96]`
- Sub: 19px desktop / 16px mobile, max-width 540px, `muted-foreground`
- Primary CTA: "Start logging — it's free" (large primary button)
- Secondary CTA: "Watch 30s demo" (ghost with `play` icon)
- Below CTAs: uppercase mono micro line — "No credit card · iOS & web · export your data anytime"
- Product preview card: large rounded-xl card with a mock set log + a mock chart side-by-side (stack on mobile)
- Features grid: 3×2 (1×6 on mobile), inside a single bordered container with hairline dividers
- Trainer callout: dark card (`bg-foreground text-background`), big quote-style headline, "Open trainer view →" CTA → `/coach`
- Footer: copyright mono + 4 text links

**Auth modal** (`AuthModal` in Landing.jsx):
- Use shadcn `<Dialog>` with custom content
- Sheet-style from bottom on mobile (`<Drawer>` from vaul is already installed — use it)
- Fields: email + password (sign-in) or name + email + password (sign-up)
- Continue with Google button (the prototype has the Google "G" SVG inlined — use it as-is)
- Switcher link at bottom: "Don't have an account? Sign up" / "Already have an account? Sign in"
- On submit, integrate with the existing Supabase Auth flow (see `lib/auth/` in the repo)
- Lift voice: "Start logging." / "Welcome back." — short, present-tense

---

## Design Tokens (full reference)

Read `design_refs/colors_and_type.css` for the canonical source. Key values:

### Colors

```css
/* Neutrals */
--ink-0:   #fcfcfa;  /* page bg */
--ink-50:  #f5f5f1;  /* raised surface */
--ink-100: #ebebe6;  /* hairline border */
--ink-150: #e0e0db;  /* slightly stronger divider */
--ink-200: #c9c9c2;  /* disabled bg */
--ink-400: #8a8a82;  /* muted text */
--ink-600: #4a4a44;  /* secondary text */
--ink-800: #1a1a17;  /* primary text */
--ink-900: #0d0d0b;  /* display / extreme */

/* Accent (USE SPARINGLY) */
--accent: #3a5fff;
--accent-hover: #2a4ff0;
--accent-press: #1f3fd9;
--accent-soft: #eaeeff;
--accent-ink: #0a1a8a;

/* Semantic (desaturated) */
--ok:      #2a8a5f;  --ok-soft:      #e6f3ec;
--warn:    #b56a1a;  --warn-soft:    #faefdb;
--danger:  #c0341a;  --danger-soft:  #faeae6;
```

These map into shadcn's variable names in `migration/app/globals.css` — see that file for the exact mapping.

### Typography

| Class | Size | Weight | Letter-spacing | Use |
|---|---|---|---|---|
| `display` | 64px | 600 | −0.03em | PR hero numerals |
| `h1` | 40px | 600 | −0.02em | Page titles |
| `h2` | 28px | 600 | −0.015em | Section headings |
| `h3` | 20px | 600 | −0.01em | Card titles |
| `h4` | 17px | 500 | −0.005em | Subhead |
| body | 15px | 400 | 0 | Default |
| small | 13px | 400 | 0 | Captions, secondary |
| micro | 11px | 500 | 0.08em UPPERCASE | Labels, tags |

Mobile: H1 shrinks to 26–28px, hero to 44px.

Font families:
- `--font-sans`: Geist (300, 400, 500, 600, 700)
- `--font-mono`: Geist Mono (400, 500, 600) — for ALL numerics, timers, labels, micro-tags
- `--font-serif`: Instrument Serif — editorial-only, not core UI

### Spacing — 4pt grid

`--s-1` 4px · `--s-2` 8px · `--s-3` 12px · `--s-4` 16px · `--s-5` 20px · `--s-6` 24px · `--s-8` 32px · `--s-10` 40px · `--s-12` 48px · `--s-16` 64px · `--s-20` 80px · `--s-24` 96px.

Cards: 24px inner padding (mobile: 16–20px). Sections separated by 48px. Stack of metadata: 8px between rows, 12px between groups.

### Radii

`--r-2` 4px (inputs, small chips) · `--r-3` 6px (buttons) · `--r-4` 10px (cards, panels) · `--r-5` 14px (large feature cards) · `--r-pill` 999px (filter chips ONLY)

### Shadows (rare)

- Cards / buttons / inputs / chrome: **no shadow**, hairline border only.
- Scrolled sticky toolbar: `--shadow-1` (1px hairline below)
- Dropdowns, popovers: `--shadow-2`
- Modals only: `--shadow-3`

### Motion

- `--d-fast` 120ms — hover/press color changes
- `--d-base` 180ms — panel/menu reveals, set-complete fade
- `--d-slow` 280ms — modal entry only
- Easing: `cubic-bezier(.2, .7, .2, 1)` everywhere (no bouncy springs, no overshoot)

---

## Voice & Copy Guide

**Sentence case** for everything in-product. Buttons: `Start workout`, `Add exercise`. Never `Start Workout` or `ADD EXERCISE`.

**UPPERCASE mono** only for micro tags: `SET 1`, `WORKING`, `WARM-UP`, `BEST`, `PR`.

**Lowercase** allowed for the wordmark `lift`.

**Voice**: coach-y but minimal. "Today — Push day." not "Welcome back, hero! 💪".

**Pronouns**: You/your. Never we/our.

**Numbers**: tabular mono. Lowercase units with single space: `82.5 kg`, `8 reps`, `1:30`.

**Operators allowed**: `×` (multiply, between reps and weight), `−` (minus for deltas), `→` (transitions), `↑` `↓` (PR deltas). En-dash `–` for ranges, em-dash `—` for breath.

**NO emoji**. Anywhere.

Examples (Lift voice vs off-brand):
| Context | ✅ Lift | ❌ Off-brand |
|---|---|---|
| Empty state | `No workouts yet. Start one.` | `Welcome! Let's begin your fitness journey 🚀` |
| PR | `New best on bench press. 102.5 kg × 5.` | `🎉 NEW PR!! You CRUSHED it!` |
| Rest | `Rest. 1:30 left.` | `Take a breather, champion!` |
| Confirm | `Delete this set?` | `Are you sure you want to permanently remove this set entry?` |
| Today header | `Today — Push day.` | `Good morning, John! Ready for your workout?` |

---

## State Management

The existing codebase uses **React Hook Form + Zod** for forms, **Supabase** for backend state, and **React state** for local UI. Stick with these.

**Active workout session state shape**:
```ts
type Session = {
  startedAt: string;          // ISO timestamp
  exercises: Exercise[];
};
type Exercise = {
  id: string;
  name: string;
  sets: Set[];
};
type Set = {
  id: string;
  kind: 'warm' | 'work';
  kg: number;
  reps: number | null;
  done: boolean;
  prev?: string;              // "82.5 × 8" display string from previous session
};
```

**Rest timer**: separate piece of state that holds the currently-resting event:
```ts
type RestEvent = { exercise: string; set: Set } | null;
```
Set this when a set is marked complete; clear when the timer dismisses or the user taps Skip.

---

## Assets

- **`design_refs/assets/lift-mark.svg`** — barbell mark for the brand logo. Monochrome, uses `currentColor`. Copy to `public/lift-mark.svg`.
- **`design_refs/assets/lift-wordmark.svg`** — `lift` lowercase wordmark with the barbell. Optional, only if you replace the YeahBuddy wordmark.
- **Icons**: Use `lucide-react` (already installed). See route specs for which icons are referenced.
- **No other custom imagery is part of this design**. User-uploaded progress photos and exercise demo videos sit in flat containers with `--r-3` radius and no shadow.

---

## Dark Mode

The Lift system in `design_refs/colors_and_type.css` defines **light theme only**. The repo's `globals.css` includes `@custom-variant dark (&:is(.dark *));` and `next-themes` is installed, but no dark token block is provided.

If dark mode is needed:
- Approximate dark palette: `--background: #0d0d0b` · `--foreground: #f5f5f1` · `--card: #1a1a17` · `--border: #2a2a25` · `--muted: #1a1a17` · `--muted-foreground: #8a8a82` · `--primary: #5a7fff` (lighter blue for contrast)
- Verify chart legibility — the accent line on dark background may need brightening.
- This should be a follow-up PR, not part of the initial migration.

---

## Files in this bundle

```
design_handoff_lift_redesign/
├── README.md                       ← THIS FILE — the implementation spec
├── migration/
│   └── app/
│       ├── globals.css             ← drop-in replacement (Step 1)
│       └── layout.tsx              ← drop-in replacement (Step 1)
└── design_refs/                    ← HTML/JSX prototypes — VISUAL REFERENCE ONLY
    ├── README_design_system.md     ← full Lift brand & voice manifest
    ├── colors_and_type.css         ← canonical token source
    ├── assets/
    │   ├── lift-mark.svg
    │   └── lift-wordmark.svg
    └── ui_kit/                     ← React prototypes (CDN React + Babel)
        ├── index.html              ← athlete app demo (Today / History / etc)
        ├── landing.html            ← marketing + auth modal demo
        ├── trainer.html            ← coach dashboard demo
        ├── components.jsx          ← shared atoms (Button, Input, Card, etc)
        ├── Sidebar.jsx
        ├── TodayScreen.jsx
        ├── HistoryScreen.jsx
        ├── LibraryScreen.jsx
        ├── PRsScreen.jsx
        ├── BodyScreen.jsx
        ├── RestTimer.jsx
        ├── Landing.jsx
        ├── TrainerApp.jsx
        └── README.md
```

---

## Implementation checklist

- [ ] **Step 1** — Drop in `globals.css` + `layout.tsx`. Verify dev server starts, fonts load, palette flips.
- [ ] **Step 2a** — Remove `shadow-sm` from `components/ui/card.tsx`
- [ ] **Step 2b** — Remove `shadow` from default `components/ui/button.tsx` variant
- [ ] **Step 2c** — Add `tnum` / `font-mono` to all numeric displays (weight, reps, calories, timer countdowns)
- [ ] **Step 2d** — Update `badge.tsx` to support uppercase mono micro-tag variant
- [ ] **Step 3a** — Restyle `components/landing/landing-page.tsx` per Lift voice + layout
- [ ] **Step 3b** — Recreate active workout session at `app/(shell)/workout/[id]/start/` per the Set Row spec
- [ ] **Step 3c** — Build Rest Timer floating component
- [ ] **Step 3d** — Restyle coach trainees views at `app/(shell)/coach/trainees/`
- [ ] **Step 3e** — Restyle progress views (history, PRs, body weight)
- [ ] **Step 4** — Replace all microcopy with Lift voice (sentence case, no emoji, "Today — Push day." idiom)
- [ ] **Verify** — Run `npm run lint`. Test all 3 user roles (trainee, coach, admin). Test mobile viewport.
- [ ] **Commit** — Follow Conventional Commits per CLAUDE.md. One commit per step is fine.

---

## Open questions

1. **Brand identity**: Keep the name "YeahBuddy Fitness" with the Lift visual style, or rename to "Lift" (or other)? The current spec keeps "YeahBuddy" but applies Lift visuals.
2. **Dark mode**: Out of scope for this PR — defer or include?
3. **Existing screens not in the prototype** (meals, schedule, admin) — for these, apply Step 1 + Step 2 polish only. Specific redesigns of these screens are a follow-up.
4. **Exercise demo videos / progress photos**: the design assumes these exist as user content but does not specify hosting/playback. Use existing Supabase storage patterns.

If unclear on any decision, ask the user before implementing.
