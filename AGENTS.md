# Project Config

This file is the single source of instructions for every coding agent in this
repo (Claude Code, Codex, Antigravity, and any tool running other models).
`CLAUDE.md` only imports it. Edit here, never in a copy.

File references below are plain relative links, not `@imports`, so every tool
can follow them. `lib/agent-docs.test.ts` fails if one of them stops existing.

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI primitives
- **Forms:** Controlled React components (no React Hook Form/Zod on the client)
- **Charts:** Recharts
- **Utilities:** date-fns, clsx, tailwind-merge, lucide-react

### Backend
- **Server:** Node.js + Express 4 + TypeScript
- **ORM:** Prisma 6
- **Database:** PostgreSQL (self-hosted Supabase)
- **Auth:** Supabase Auth + @supabase/ssr (SSR cookie-based sessions)

### Infrastructure
- Frontend proxies `/backend/*` → Express API (port 4000)
- No Redis, no Docker Compose in active use

## Rendering Strategy
Routes live under `app/`; `(shell)` is the signed-in layout group.

| Route | Strategy |
|---|---|
| `app/page.tsx`, `(shell)/layout.tsx` | SSR — auth redirect |
| `(shell)/dashboard`, `coach/` | SSR + Suspense streaming, `revalidate = 30` |
| `(shell)/workout` | SSR fetch (`revalidate = 30`) → CSR client board |
| `(shell)/coach/exercises`, `coach/find`, `coach/trainees/[id]` | Hybrid — SSR fetch → CSR client component |
| `(shell)/profile`, `progress/` | Hybrid — SSR auth/fetch → CSR client component |
| `(shell)/meals`, `schedule/` | CSR — server page only renders the client component |
| `(shell)/trackweight` | SSR route wrapper → lazy CSR client component |
| `reset-password/`, `workout/[id]/start/` | CSR |

## Data Flow — find before you add
Every feature's data passes through the same four layers. Before adding one,
search them **top-down** and stop at the first layer that already has it.

```
backend/src/routes/*.route.ts      endpoint (+ *.schemas.ts zod input) → backend/src/services/
          ↓  HTTP via the /backend/* proxy
lib/{fitness,admin,auth,feedback}/api.ts   typed client functions: fetchX(accessToken, …)
          ↓                                ↘ server pages (app/**/page.tsx) call these directly for SSR
lib/queries/*.ts                    React Query hooks; cache keys in lib/queries/keys.ts
          ↓
components/                         call hooks, not api.ts
```

1. **Hook exists** in `lib/queries/` → use it. Two screens on the same hook share
   one cache entry, so a mutation's invalidation updates both.
2. **Client function exists** in `lib/*/api.ts` but no hook → add the hook next
   to its siblings, with a key in `queryKeys`.
3. **Endpoint exists** in `backend/src/routes/` but no client function → add the
   function to the matching `api.ts`.
4. **Nothing fits** → if an endpoint returns almost the right data, extend it (a
   query param or field) rather than adding a parallel one. Otherwise add route →
   service → client function → hook, in that order.

About 16 older components call `api.ts` directly (Google import, feedback,
one-off actions). Do not copy that pattern for data that is displayed or cached;
go through a hook.

## User Roles
Three roles: **trainee**, **coach**, **admin** — enforced server-side via `requireAppSession()`.

## Skills — read before working in that area
- Frontend (UI, components, theme, i18n, data fetching): [skills/frontend-system/SKILL.md](skills/frontend-system/SKILL.md)
- Supabase (auth, RLS, storage, CLI, migrations): [.agents/skills/supabase/SKILL.md](.agents/skills/supabase/SKILL.md)
- Postgres queries, indexes, schema design: [.agents/skills/supabase-postgres-best-practices/SKILL.md](.agents/skills/supabase-postgres-best-practices/SKILL.md)

Shared skills live in `.agents/skills/` (installed with `npx skills add`, pinned in
`skills-lock.json`). `.claude/skills/` holds symlinks into it; do not copy skills
into a tool-specific folder.

## Ground Rules
1. All API responses use `{ data, error, meta }` format.
2. Every API route uses the `AppError` class ([backend/src/services/errors.ts](backend/src/services/errors.ts)) — never throw raw `Error`. Enforced by ESLint. The central `errorHandler` formats them; 5xx messages are never sent to the client.
   - New routes use `validated()` / `asyncHandler()` from [backend/src/middleware/validate.ts](backend/src/middleware/validate.ts) and throw; they do not catch and format their own errors.
   - Request input is validated with zod at the route boundary; business rules with localized messages stay in the services.
3. Use Prisma for all database queries — no raw SQL except in migration files.
4. Frontend components use named exports, not default exports.
5. Every database change requires a migration file.
6. Commits follow Conventional Commits: `type(scope): description`.
   - No AI attribution: no `Co-Authored-By:` or `Claude-Session:` trailers in commit messages, and no "Generated with …" footers, session links or tool credits in PR descriptions, comments or reviews.
7. Never commit `.env`, credentials, or secrets.
8. Server components fetch data via server-side API calls; do not expose service-role keys to the client.
9. Reuse before you build: before creating a component, search `components/` for one that already renders the same data — grep the visible labels, i18n keys and the prop type (e.g. `{ workout: Workout }`). File names can mislead (`WorkoutPlanPreview` lives in `workout-log-review.tsx`). Create a new component only when nothing fits.
10. Reuse APIs the same way: follow **Data Flow** above — look for a hook, then a client function, then an endpoint, before writing a new one.

## Commands
```bash
# Frontend
npm run dev          # Next.js dev server on :3000
npm run build        # Production build
npm run lint         # ESLint (covers app/, components/, lib/ AND backend/src/)
npm run typecheck    # next typegen + tsc --noEmit
npm test             # Vitest (components/, lib/)

# Backend
npm run dev:backend  # Express dev server on :4000 (opens the SSH tunnel to the DB)
npm run build:backend
npm --prefix backend run typecheck
npm --prefix backend run test        # Vitest
npm --prefix backend run test:watch

# Database
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
npm run prisma:studio
```

## Sub-agent workflow (Codex only)

Custom roles are defined in `.codex/agents/*.toml`: `frontend`, `backend`,
`database`, `fitness-ai`, and `reviewer`. Each inherits the parent model and reasoning.
Other tools ignore this section.

- For tasks with independent substantial parts, delegate to the relevant sub-agents.
  Handle small local fixes directly. Use at most 3 concurrent sub-agents.
- The primary agent owns requirements, API contracts, file assignments, integration,
  final validation, and Git operations. Give each writer explicit file ownership.
- Do not assign overlapping write scopes. Agents must preserve others' edits and
  request coordination before changing shared files or crossing their scope.
- Agree on schema/API contracts before parallel frontend/backend implementation.
  Run the reviewer after implementation; it reports findings without editing source.
- Wait for required results and integrate them before claiming completion.
  Report actual test/runtime evidence and anything unverified.

Example: "Use backend for the API, frontend for the UI in separate assigned files,
then reviewer for the final diff. Wait for all results and run integration checks."

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
