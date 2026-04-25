# Project Config

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI primitives
- **Forms:** React Hook Form 7 + Zod validation
- **Charts:** Recharts
- **Drag & Drop:** @dnd-kit
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
| `(shell)/dashboard`, `coach/`, `workout/`, `schedule/` | SSR + Suspense streaming, `force-dynamic` |
| `(shell)/coach/exercises`, `coach/find`, `coach/trainees/[id]` | Hybrid — SSR fetch → CSR client component |
| `(shell)/profile`, `meals/`, `progress/`, `trackweight/` | CSR — `"use client"`, hooks |
| `reset-password/`, `workout/[id]/start/` | CSR |

## User Roles
Three roles: **trainee**, **coach**, **admin** — enforced server-side via `requireAppSession()`.

## Skills
@.claude/skills/backend/README.md
@.claude/skills/frontend/README.md
@.claude/skills/database/README.md
@.claude/skills/git/README.md
@.claude/skills/seo-content/README.md

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
