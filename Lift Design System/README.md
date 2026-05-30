# Lift — Design System

A minimal design system for a web-based gym workout log. **Lift** is for lifters who want to log a set fast, see their last numbers, and move on.

> **Brief**: Track sets, reps, weight, body measurements, PRs, and rest timers — all on a balanced/clean web UI with a slight coach-y voice.

**Provided sources**
- Reference: <https://hevy.com> — used as a high-level pattern reference for the *information architecture* of workout logging (exercise → sets → reps × weight). Visual language is original to this system; we did not copy Hevy's chrome.
- No codebase, Figma, or design files were attached. Foundations and screens were built from scratch.

---

## Index — manifest of this folder

| Path | What's inside |
| --- | --- |
| `README.md` | This file — brand, voice, foundations, iconography |
| `colors_and_type.css` | All CSS tokens (color, type, space, radius, shadow, motion) + drop-in semantic element styles (`h1`, `.display`, `.label`, `.numeric`, etc) |
| `SKILL.md` | Cross-compatible Claude Code skill manifest |
| `assets/` | Logos (`lift-mark.svg`, `lift-wordmark.svg`) and any imagery |
| `preview/` | Small HTML cards that populate the Design System tab |
| `ui_kits/web/` | Pixel-perfect web UI kit: components + 5 interactive screens (`index.html` is the focal entry point) |

> No slide template was provided, so no `slides/` directory exists.

---

## Brand snapshot

**Name** Lift
**Mark** Stylized barbell — one bar, two plates per side. Monochrome, never tinted.
**Tagline (working)** *Log the set. Move on.*
**Personality** Coach-y but minimal. Reads like a quiet friend who knows your numbers — never a hype-machine, never clinical.

---

## CONTENT FUNDAMENTALS

### Voice
- **Second-person, present tense.** "You hit 285 × 5 today." Not "User completed…"
- **Short.** Sentences average 5–9 words. No semicolons. No emoji.
- **Coach-y, not hype-y.** "Push day." "One more set." Never "Crush it 🔥💪".
- **Numbers carry the meaning.** Copy is scaffolding around the data, not decoration.

### Casing
- **Sentence case** for everything in-product: buttons, headings, labels, menu items.
  - ✅ `Start workout` `Add exercise` `Personal records`
  - ❌ `Start Workout` `ADD EXERCISE`
- **UPPERCASE micro-labels** only for tags / data labels in mono (`SET 1`, `WORKING`, `WARM-UP`, `BEST`). Always 11px, tracked +0.08em, monospace.
- **Lowercase** allowed for the wordmark only (`lift`).

### Pronouns
- **You/your** for the lifter. Never "I/my" — this is not a journaling app, it's a log.
- **We** is avoided. There's no character or brand voice speaking *at* the user.

### Examples

| Context | ✅ Lift voice | ❌ Off-brand |
| --- | --- | --- |
| Empty state | *No workouts yet. Start one.* | *Welcome! Let's begin your fitness journey 🚀* |
| PR celebration | *New best on bench press. 102.5 kg × 5.* | *🎉 NEW PR!! You absolutely CRUSHED it!* |
| Rest timer | *Rest. 1:30 left.* | *Take a breather, champion!* |
| Confirm delete | *Delete this set?* | *Are you sure you want to permanently remove this set entry?* |
| Today header | *Today — Push day.* | *Good morning, John! Ready for your workout?* |
| Unit label | `kg` `reps` `min` | `kilograms` `repetitions` `minutes` |

### Numbers + units
- Numbers always **tabular** (mono, `font-feature-settings: 'tnum' 1`).
- Units are lowercase, single space: `82.5 kg`, `8 reps`, `1:30 min`.
- Decimals only when meaningful: `82.5 kg` ✅, `82.50 kg` ❌, `8.0 reps` ❌.
- Time uses `mm:ss` for timers, `HH:mm` for clocks.

### Emoji & special characters
- **No emoji.** Anywhere.
- Mathematical operators allowed and encouraged: `×` (multiply, between reps and weight), `−` (minus for deltas), `→` (transitions), `↑` `↓` (PR deltas).
- En-dash `–` for ranges, em-dash `—` for breath.

---

## VISUAL FOUNDATIONS

### Color
- **Palette is mostly grayscale.** A warm paper-white background (`--ink-0` `#fcfcfa`) and a near-black foreground (`--ink-800` `#1a1a17`). The grays are subtly warm — never blue-cold.
- **One accent: electric blue `#3a5fff`.** Reserved for: active set indicator, primary CTA, focus rings, the current bar in charts, today's date. If three blue things are on screen you've used it twice too many.
- **Semantics are muted.** `--ok` is a forest green, `--danger` is a brick red — both desaturated so they don't compete with the accent.
- **No gradients.** Anywhere. Surfaces are flat tints from the `--ink-*` ramp.

### Type
- **Geist** for everything UI (300/400/500/600/700).
- **Geist Mono** for numerals, labels, tags, timers, set counters — anything tabular.
- **Instrument Serif** is available for occasional editorial moments (an empty-state pull quote, a marketing header) but is *not* a core UI face.
- Display sizes lean huge: a PR is `64px / 600 / -0.03em tracking`. Body sits at 15px. We use scale for hierarchy more than weight.

### Spacing
- 4-pt grid. `--s-1` through `--s-24`.
- **Cards breathe.** A typical card has `24px` inner padding, never less than `16px`. Stacks of metadata use `8px` between rows, `12px` between groups.
- **Whitespace is structural**, not decorative. Two cards separated by `48px` say "different concept"; by `8px` say "same concept, different facet".

### Backgrounds, imagery, illustration
- **No background images. No hand illustrations. No textures. No gradients.**
- Imagery is reserved for user-uploaded progress photos or exercise demo loops (placeholder slots in the kit). When present, they sit in a flat container with `--r-3` radius and no shadow.
- Charts are *the* visual: bars and lines in `--accent` over `--ink-100` tracks.

### Borders & dividers
- **Hairlines do the work of shadows.** `1px solid var(--ink-100)` for almost everything. `--ink-150` when slightly stronger contrast is needed. `--ink-800` (near-black) only for an emphasized input on focus or a primary outline button.
- No double borders. No inset rings except focus.

### Shadows
- Shadows are nearly absent.
- `--shadow-1` (1px hairline) on sticky toolbars when scrolled.
- `--shadow-2` for dropdown menus.
- `--shadow-3` for modals only.
- Never on cards, buttons, inputs, or chrome.

### Corner radii
- `--r-2` (4px) on inputs, small chips, table cells.
- `--r-3` (6px) on buttons.
- `--r-4` (10px) on cards, panels, modal containers.
- `--r-pill` only on filter chips and avatar stacks.
- **Nothing is fully rounded except chips.** No "squircle" big-radius cards.

### Animation
- **Fast, near-invisible.** `--d-fast` (120ms) for hover/press color changes. `--d-base` (180ms) for panel/menu reveals. `--d-slow` (280ms) only for entering modals.
- Easing is `cubic-bezier(.2, .7, .2, 1)` — out-quad-ish; nothing bounces. Springy / overshoot feels off-brand.
- **One signature motion**: completing a set fades the row from white → `--ink-50` over 180ms and stamps a green check. That's the whole celebration.

### Hover & press
- **Buttons (primary)**: hover darkens accent by one step; press by two.
- **Buttons (ghost) & rows**: hover shifts background `transparent → --ink-50`.
- **Press**: no scale, no shrink. Just a darker tint. (Scale-on-press reads "playful"; off-brand here.)
- **Disabled**: 40% opacity, `cursor: not-allowed`, no hover response.

### Focus
- Visible ring on every interactive element: 3px `--accent-soft` halo + 1px `--accent` border. `outline: none` then re-apply via `box-shadow: var(--ring)`.

### Transparency & blur
- **Used in exactly one place**: the sticky workout-log toolbar when it overlaps scrolling content uses `backdrop-filter: blur(8px)` + 80% white. Nowhere else.

### Cards
- White surface (`--ink-0` or `--ink-50` for raised), `1px solid var(--ink-100)`, `--r-4`, `24px` padding. **No shadow.** Hover does not lift.

### Layout rules
- Max content width `1240px`. Sidebar `240px` fixed on desktop, collapses to a `64px` rail at `< 1024px`, hides under a sheet at `< 768px`.
- Sticky elements: the workout-log toolbar (top of the log surface) and the rest-timer footer (when active). Both use the blur+white treatment.
- Tables are the workout log's natural form. They are not styled like spreadsheets — hairlines only between rows, never between cells.

---

## ICONOGRAPHY

- **Icon set: [Lucide](https://lucide.dev)** — loaded from `unpkg.com/lucide@latest` via CDN. Lucide's stroke style (1.5px, rounded joins, square caps) matches Lift's hairline-driven aesthetic.
- **Why Lucide?** Open-source, broad coverage, consistent geometry, free for commercial use. We considered Heroicons but Lucide's stroke weight reads better at 16–20px (our default sizes).
- **Substitution flag**: this is a CDN-sourced set, not a custom icon font. If you want a bespoke icon family, please flag it and we'll author one.
- **Sizes**: `16px` (inline, in row context), `20px` (buttons, nav), `24px` (page headers / empty states), `32px+` (illustrative empty states only).
- **Color**: `currentColor` — icons inherit text color. Never tinted with the accent unless the icon is *itself* the focus (e.g. the active nav item).
- **Stroke weight**: `1.5` everywhere. Do not mix weights.
- **No emoji. No unicode glyphs as icons** (except the operators `× − → ↑ ↓` in copy).
- **No custom-drawn SVG icons in this kit.** If a concept needs an icon Lucide doesn't have, we propose a near-match (e.g. `dumbbell` for "exercise"); contact the design lead before drawing a new one.

**Common Lift icons & their meanings**

| Lucide name | Meaning |
| --- | --- |
| `dumbbell` | Exercise / log entry |
| `calendar` | History |
| `flame` | PR / streak |
| `ruler` | Body measurements |
| `timer` | Rest timer |
| `bar-chart-3` | Stats |
| `plus` | Add set / exercise |
| `check` | Set complete |
| `more-horizontal` | Row menu |
| `chevron-down` | Disclosure |
| `search` | Exercise library search |

---

## How to use this system

**For prototyping** — Open `ui_kits/web/index.html` to see the full interactive recreation. Each `.jsx` component is independently importable.
**For production handoff** — `colors_and_type.css` is drop-in; copy it into your build, then read the component JSX as a spec, not as production code.
**For an AI agent** — Read `SKILL.md` first; it points back here.
