# Trainer / Programs — ready-to-paste TSX

Production TSX for the **coach Programs page**, written against your real codebase:
shadcn primitives, Lift tokens already in `app/globals.css`, your `@/lib/fitness/api` functions, `useAuth()`, `next/navigation`. No stubs — every action calls a function that already exists in `lib/fitness/api.ts`.

## What you get vs. the current page
The current `coach/programs/page.tsx` lists programs with a single **View Details** button. This version adds the Lift coach UX:
- **Kebab menu** per card → Edit · Assign · Duplicate · Delete (Delete in destructive red).
- Footer **Assign** + **Edit** buttons.
- **Assign-clients dialog** — searchable, multi-select, pre-checks current assignments, diffs and calls the API.
- **Duplicate** (clones the program server-side) and **Delete** (with confirm), both optimistic.
- Lift styling: `rounded-[10px]`, hairline borders, **no shadow**, `font-semibold`, `.label-micro`, `font-mono tnum` numbers, single electric-blue accent.

## Files & where they go
Copy each file to the **same path** in your repo:

| File | Path in repo |
|---|---|
| `program-card.tsx` | `components/coach/program-card.tsx` |
| `assign-clients-dialog.tsx` | `components/coach/assign-clients-dialog.tsx` |
| `programs-board.tsx` | `components/coach/programs-board.tsx` |
| `page.tsx` | `app/(shell)/coach/programs/page.tsx` *(replaces current)* |

```bash
cp -r design_handoff_coach/programs_tsx/components/coach/* ./components/coach/
cp design_handoff_coach/programs_tsx/app/\(shell\)/coach/programs/page.tsx ./app/\(shell\)/coach/programs/page.tsx
npm run dev
```

## How actions are wired (all real API)
- **Edit** → `router.push('/coach/programs/{id}')` (your existing `ProgramEditor` route).
- **New program** → `/coach/programs/new` (existing).
- **Assign** → `assignCoachProgram(token, programId, traineeId)` for added clients, `unassignCoachProgram(token, programId, traineeId)` for removed. Roster comes from `fetchCoachTrainees(token)` (fetched in `page.tsx`, passed down).
- **Duplicate** → `fetchCoachProgram(token, id)` (to load the full workout tree) → map to `CreateCoachProgramInput` → `createCoachProgram(token, input)`.
- **Delete** → `deleteCoachProgram(token, id)`.
- Auth token via `useAuth().session.access_token` — same pattern as `pending-requests-panel.tsx`.

## Notes / things to verify
1. **Duplicate mapping.** `programs-board.tsx → toCreateInput()` derives each exercise's `sets` from `exercise.sets.length` and `reps` from the first set's `targetReps`. If your `CreateCoachProgramInput` needs per-set detail, extend that mapper. Defaults: `sets || 3`, `reps ?? 8`.
2. **Difficulty values.** Card assumes `beginner | intermediate | advanced`. Adjust `difficultyTone` if your enum differs.
3. **Copy.** Strings are literal English (matching the current page). Swap to `useLocale().messages` if you want i18n — `program-card` and the dialog are client components so `useLocale()` works there.
4. **Stats / Suspense.** `page.tsx` fetches programs + trainees with `Promise.all` and renders synchronously. If you prefer your previous streaming `Suspense` skeletons, wrap `ProgramsBoard` and the stats in `Suspense` and keep the `cache()`d fetches — the board itself doesn't care.
5. **shadcn deps used** (all already in your repo): `button`, `avatar`, `dropdown-menu` (uses `variant="destructive"` — confirmed present), `dialog`, `input`. No new dependencies.

## Behaviour reference
The exact interactions are demonstrated in `../prototype/coach-prototype.html` (open it, go to **Programs**): kebab menu, edit modal, week-grid builder, create-routine, and the assign multi-select.
