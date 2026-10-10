# Project Config

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI primitives
- **Forms:** Controlled React state; React Hook Form/Zod chưa được cài
- **Charts:** Recharts
- **Utilities:** date-fns, clsx, tailwind-merge, lucide-react

### Backend
- **Server:** Node.js + Express 4 + TypeScript
- **ORM:** Prisma 6
- **Database:** PostgreSQL (hosted on Supabase)
- **Auth:** Supabase Auth + @supabase/ssr (SSR cookie-based sessions)

### Infrastructure
- Frontend proxies `/backend/*` → Express API (port 4000)
- No Redis, no Docker Compose in active use

## Rendering Strategy
| Route | Strategy |
|---|---|
| `app/page.tsx`, `(shell)/layout.tsx` | SSR — auth redirect |
| `(shell)/dashboard`, `workout/`, `schedule/` | SSR + Suspense streaming |
| `(shell)/coach/exercises`, `coach/find`, `coach/trainees/[id]` | Hybrid — SSR fetch → CSR client component |
| `(shell)/profile`, `meals/`, `progress/` | Hybrid — SSR auth/fetch → CSR client component |
| `(shell)/trackweight` | SSR route wrapper → lazy CSR client component |
| `reset-password/`, `workout/[id]/start/` | CSR |

## User Roles
Three roles: **trainee**, **coach**, **admin** — enforced server-side via `requireAppSession()`.

## Skills
@.Codex/skills/backend/README.md
@skills/frontend-system/SKILL.md
@.Codex/skills/database/README.md
@.Codex/skills/git/README.md
@.Codex/skills/seo-content/README.md

## Sub-agent workflow (Codex)

Custom roles are defined in `.codex/agents/*.toml`: `frontend`, `backend`,
`database`, `fitness-ai`, and `reviewer`. Each inherits the parent model and reasoning.

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

## Ground Rules
1. All API responses use `{ data, error, meta }` format.
2. Every API route uses `AppError` class — never throw raw `Error`.
3. Use Prisma for all database queries — no raw SQL except in migration files.
4. Frontend components use named exports, not default exports.
5. Every database change requires a migration file.
6. Commits follow Conventional Commits: `type(scope): description`.
7. Never commit `.env`, credentials, or secrets.
8. Server components fetch data via server-side API calls; do not expose service-role keys to the client.

## Commands
```bash
# Frontend
npm run dev          # Next.js dev server on :3000
npm run build        # Production build
npm run lint         # ESLint

# Backend
npm run dev:backend  # Express dev server on :4000
npm run build:backend

# Database
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
npm run prisma:studio
```

## Slash Commands
- `/review <file>` — review code, find bugs and convention violations
- `/migration <description>` — generate UP + DOWN migration SQL
- `/deploy <env>` — deployment checklist
- `/git <description>` — generate commit message + PR description
- `/seo <url-or-content>` — generate meta tags + OG + schema.org JSON-LD

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
