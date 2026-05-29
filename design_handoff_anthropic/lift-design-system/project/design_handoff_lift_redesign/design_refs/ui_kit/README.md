# Lift — Web UI kit

A pixel-targeted recreation of the Lift web app, built as small, composable React components. Use these as a spec for production, or import them into prototypes.

## Files

- `landing.html` — public marketing page with sign in / sign up modal. Entry point before login.
- `index.html` — the logged-in athlete app. Today / History / Library / PRs / Body.
- `trainer.html` — coach dashboard. Client roster + per-client detail.
- `components.jsx` — shared atoms: `Button`, `Input`, `NumInput`, `Chip`, `Tag`, `Card`, `Icon`, `Avatar`, `Toolbar`, `useIsMobile`.
- `Sidebar.jsx` — athlete-app left rail (desktop) + bottom tab bar (mobile).
- `TodayScreen.jsx` — active workout log. Add exercises, log sets, complete sets, trigger rest timer.
- `HistoryScreen.jsx` — monthly calendar of past workouts with a list of recent sessions.
- `LibraryScreen.jsx` — searchable, chip-filtered exercise library.
- `PRsScreen.jsx` — personal records with 1RM-estimate line charts.
- `BodyScreen.jsx` — body-weight + measurement tracking with a line chart.
- `RestTimer.jsx` — sticky bottom blur+white timer (the one transparency surface in the system).
- `Landing.jsx` — landing page (hero, features, trainer callout, footer) + `AuthModal`.
- `TrainerApp.jsx` — coach sidebar, client list, client detail.

## Conventions

- All components consume tokens from `../../colors_and_type.css`. They never hard-code hex.
- Numbers are always in `Geist Mono` with `font-feature-settings: 'tnum' 1`.
- All icons come from Lucide via the CDN UMD bundle (`lucide.min.js`).
- Components export to `window` at the end of each file so other Babel scripts can use them.

## Click-through

The prototype supports:
- Switching screens via the sidebar.
- On `Today`: clicking the checkbox completes a set, which dims the row, stamps a green check, and pops the rest timer.
- The rest timer dismisses with `Skip` or auto-clears after a few seconds (sped up from 90s for demo).
- Adding a set increments the set count for that exercise.
- The library search filter is live.

## Not implemented (out of scope for the kit)

- Real persistence (state is in-memory).
- Authentication / multi-user.
- Drag-to-reorder of exercises.
- Apple Health / Google Fit sync.
