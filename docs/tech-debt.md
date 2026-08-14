# Tech debt register

Tracked, deliberate debt — each item states what is wrong, why it was not fixed
immediately, and what "done" looks like. Items are ordered by the risk they carry.

---

## 1. `services/fitness-data/core.ts` is still 6.5k lines

**Status:** in progress — 443 lines extracted so far.

The file accumulated every trainee- and coach-facing service. The domain barrels
(`coach.ts`, `workout.ts`, `program.ts`, …) already existed but were pure re-export
facades: all 216 declarations lived in `core.ts`.

### Method

There is no behavioural test coverage over `core.ts`, so the split proceeds by
**pure code motion, leaf-first** — never editing logic in the same step as moving
it. Each step is verified by `typecheck` + `lint` + `test`, and TypeScript proves
every reference still resolves. Modules are extracted only once nothing they depend
on remains in `core.ts`, which keeps the import graph acyclic; a cycle here would
surface as a module-init TDZ error that typechecking cannot catch.

### Done

| Module | Lines | Contents |
|---|---:|---|
| `shared/dates.ts` | 155 | UTC day keys vs. local-time windows (covered by `dates.test.ts`) |
| `shared/guards.ts` | 57 | `ensurePrisma`, role asserts, coach↔trainee ownership |
| `shared/workout-snapshot.ts` | 117 | Readers for the JSON exercise snapshot on `WorkoutLog` |
| `shared/analytics.ts` | 290 | Volume, streaks, PRs, strength progression — all pure |

### Remaining, in dependency order

1. `shared/selects.ts` — the `*_SELECT` / `*_INCLUDE` fragments and their `*Record`
   types (~28 declarations). Needed by nearly everything else, so it goes next.
2. `shared/serializers.ts` — `serializeWorkout`, `serializeProgram`,
   `serializeWorkoutLog`, `serializeNotification`, … (~15).
3. `shared/coach-updates.ts` — the `buildExerciseCoachUpdate` /
   program-metadata cluster (~25). The densest remaining knot.
4. `shared/schedule.ts` — occurrence keys, assignment week visibility,
   `buildSerializedScheduleEntriesForWeek` (~12).
5. `shared/workout-history.ts` — previous-set performance lookup (~8).
6. Domain files: move each public function from `core.ts` into the barrel that
   already exports it (`coach`, `workout`, `program`, `exercise`, `progress`,
   `meal`, `notification`, `dashboard`), then delete `core.ts`.

**Done when** `core.ts` no longer exists and no file under `services/fitness-data/`
exceeds ~600 lines. External imports never change: everything resolves through
`fitness-data/index.ts`.

### Tooling

The analysis scripts used for the partition are not committed; regenerate with a
top-level-declaration inventory plus reachability from each barrel's export list.
The useful output was: which private helper is reachable from exactly one domain
(move it there) versus several (it belongs in `shared/`).

---

## 2. React Compiler lint rules are warnings, not errors

**Status:** accepted, ~44 warnings.

Next 16 ships `react-hooks` v6, whose React Compiler rules the existing components
predate:

| Rule | Count |
|---|---:|
| `react-hooks/set-state-in-effect` | 33 |
| `react-hooks/exhaustive-deps` | 9 |
| `react-hooks/preserve-manual-memoization` | 6 |
| `react-hooks/refs` | 4 |
| `react-hooks/purity` | 1 |

They are set to `warn` in `eslint.config.mjs` so CI is a meaningful gate today.
They are **not** cosmetic: `set-state-in-effect` marks effects that reset derived
state and cause a second render pass, and each fix changes render behaviour in a
component with no test coverage. Fixing 33 of them in one pass, in a live app,
would be a large uninstrumented change.

**Done when** the components are migrated to derive-during-render (or `key`-based
resets) and the four compiler rules are promoted to `error`. Burn down per screen,
not repo-wide.

---

## 3. Most routes still format their own errors

**Status:** partially fixed.

`ai.route.ts`, `auth.route.ts` and `workout.route.ts` now throw and let the central
`errorHandler` produce the `{ data, error, meta }` envelope. The remaining routers
(`admin`, `coach`, `dashboard`, `exercise`, `food`, `meal`, `notification`,
`progress`) still `try/catch` and call `sendApiError` / `sendError`.

Those helpers were rewritten to emit exactly the same shape as `errorHandler`, so
responses are already consistent — this is duplication, not a behavioural gap.

**Done when** every router uses `asyncHandler` / `validated`, and `sendApiError`
and `sendError` are deleted. `sendData` stays.

---

## 4. Input validation covers three routers

**Status:** partially fixed.

Zod schemas guard `/api/ai/*`, `/api/auth/*` and `/api/workouts/*`. The other
routers still hand-coerce (`String(req.body.x ?? "")`), which turns a malformed
field into `""` or `0` and writes it, instead of rejecting it.

**Done when** every router validates at the boundary. `admin.route.ts` and
`coach.route.ts` carry the most surface and should go first.

---

## 5. `createWorkoutLogSchema.exercises` is structurally validated only

The logged-set payload is checked as a bounded array of unknowns rather than
against `serializeWorkout()["exercises"]`. Writing that shape out here would
duplicate a large type owned by the fitness-data service and drift from it. The
service re-validates the payload against the stored workout.

**Done when** the serialized workout shape is derived from a single zod schema that
both the service and the route boundary import.

---

## 6. Frontend god files

`components/admin/admin-console.tsx` (2.3k), `lib/fitness/api.ts` (2.1k),
`app/workout/[id]/start/page.tsx` (1.7k), `components/schedule/weekly-calendar.tsx`
(1.6k), `components/coach/program-editor.tsx` (1.5k).

`admin-console.tsx` is mid-extraction already: the exercises panel moved out to
`admin-exercises-panel.tsx`, leaving behind state that is now written but never
read. Two such cases are flagged in-file.

**Done when** each is decomposed and no component file exceeds ~500 lines. There is
no frontend test runner yet, so this needs one first — see item 7.

---

## 7. No frontend tests

The Vitest suite (141 tests) covers the backend only: middleware, error model, env
loading, request schemas, the TTL cache, nutrition maths and date handling.

The frontend has no test runner. Highest-value first targets are the pure modules:
`lib/fitness/api.ts` response mapping, `lib/exercise-search`, `lib/workout-reps`,
`components/coach/program-excel.ts` import parsing.

**Done when** Vitest + Testing Library run in CI over `app/`, `components/`, `lib/`.

---

## 8. `npm audit` reports 11 vulnerabilities

Mostly transitive, with `xlsx` the notable direct dependency (it has no fixed
release on npm and is used by both the frontend export and the backend). Assess
whether `exceljs` — already a dependency — can replace it entirely; the newer
template writer in `program-excel.ts` already uses ExcelJS.

---

## 9. Deploy still allows SSH password auth

`deploy-backend.yml` passes both `key` (`VPS_SSH_KEY`) and `password`
(`VPS_PASSWORD`); the key wins when the secret exists. This is a deliberate
migration step so the switch does not break deploys before the key is installed.

**Done when** `VPS_SSH_KEY` is configured, the `password:` line is removed, and
password auth is disabled in the VPS `sshd_config`.
