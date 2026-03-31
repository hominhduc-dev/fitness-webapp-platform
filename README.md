# Fitness App

Engineering guide for the `fitness-app` repository.

This project is split into two applications:

- A Next.js frontend in the repo root
- A standalone Express + Prisma backend in `backend/`

The frontend appears to have originated from `v0`, but this README is intended to be the maintained source of truth for engineers working in the codebase.

## Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI components
- Supabase auth/client integration
- Vercel Analytics

### Backend

- Express
- TypeScript
- Prisma
- PostgreSQL
- Supabase

## Repository Layout

```text
.
|-- app/                 # Next.js App Router pages, layouts, route handlers
|-- components/          # Feature UI and shared UI primitives
|-- hooks/               # Reusable React hooks
|-- lib/                 # Frontend auth, API clients, i18n, shared types
|-- public/              # Static assets
|-- styles/              # Global styling
|-- backend/
|   |-- prisma/          # Prisma schema
|   |-- src/
|   |   |-- config/      # Backend env/config loading
|   |   |-- lib/         # Prisma and Supabase clients
|   |   |-- routes/      # Express route modules
|   |   |-- services/    # Backend domain logic
|   |   `-- scripts/     # Utility scripts such as admin bootstrap
|   `-- README.md        # Backend-specific notes
|-- proxy.ts             # Next.js proxy/middleware for protected routes
`-- README.md            # This guide
```

## Product Areas

- Authentication and profile management
- Workout planning and workout logging
- Meal tracking and nutrition summaries
- Coach discovery, requests, programs, and trainee management
- Admin dashboard and operational reporting
- English and Vietnamese localization

## Main Entry Points

### Frontend

- `app/layout.tsx`: root app shell
- `app/page.tsx`: public landing page
- `proxy.ts`: auth-aware route protection for app areas
- `lib/auth/`: session and profile helpers
- `lib/fitness/api.ts`: typed frontend client for backend fitness APIs

### Backend

- `backend/src/index.ts`: server bootstrap
- `backend/src/app.ts`: Express app configuration
- `backend/src/routes/index.ts`: API router registration
- `backend/prisma/schema.prisma`: database schema

## Routes at a Glance

### Frontend routes

- `/`: landing page
- `/dashboard`
- `/meals`
- `/profile`
- `/progress`
- `/schedule`
- `/workout`
- `/coach`
- `/coach/find`
- `/coach/programs`
- `/coach/trainees`
- `/admin`
- `/auth/callback`
- `/reset-password`

### Backend API routes

- `/api/auth`
- `/api/admin`
- `/api/coach`
- `/api/exercises`
- `/api/meals`
- `/api/workouts`
- `/api/health`

## Prerequisites

- Node.js 20+
- npm
- A Supabase project
- A PostgreSQL connection string compatible with Prisma

## Environment Setup

### Frontend

Create `.env.local` from `.env.local.example`.

```bash
cp .env.local.example .env.local
```

Required values:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Backend

Create `backend/.env` from `backend/.env.example`.

```bash
cp backend/.env.example backend/.env
```

Required values:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Notes:

- `DATABASE_URL` is used for normal Prisma runtime traffic.
- `DIRECT_URL` is used for migrations and direct schema operations.
- The frontend talks to the backend through `NEXT_PUBLIC_API_URL` on the server and `/backend` in the browser.

Auth email notes:

- Signup confirmation and forgot-password emails are sent by Supabase.
- Configure email templates and SMTP, if needed, inside your Supabase project settings rather than this backend.

## Installation

Install dependencies for both apps:

```bash
npm install
npm --prefix backend install
```

## Local Development

Start the frontend:

```bash
npm run dev
```

Start the backend in a second terminal:

```bash
npm run dev:backend
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## Docker

This repo can run with Docker Compose using two containers:

- `frontend`: Next.js app on port `3000`
- `backend`: Express + Prisma API on port `4000`

### 1. Prepare Docker env

Copy the example file and fill in the real values:

```bash
cp .env.docker.example .env.docker
```

Important notes:

- Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local Docker usage.
- Keep `NEXT_PUBLIC_API_URL=http://backend:4000` so the frontend container can reach the backend container.
- Keep `API_URL_INTERNAL=http://backend:4000` for server-side requests from Next.js.
- Set `DATABASE_URL`, `DIRECT_URL`, and the Supabase keys to real values before starting.

### 2. Build and start

```bash
docker compose --env-file .env.docker up --build
```

### 3. Open the app

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/api/health`

### 4. Stop the stack

```bash
docker compose down
```

## Scripts

### Root scripts

```bash
npm run dev
npm run build
npm run start
npm run dev:backend
npm run build:backend
npm run start:backend
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
npm run prisma:studio
npm run prisma:validate
npm run create:admin -- --email you@example.com
```

### Backend-only scripts

```bash
npm --prefix backend run dev
npm --prefix backend run build
npm --prefix backend run start
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:studio
npm --prefix backend run prisma:validate
npm --prefix backend run create:admin -- --email you@example.com
```

## Database Workflow

After backend environment variables are configured:

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:push
```

Use migrations when making deliberate schema changes:

```bash
npm run prisma:migrate
```

Inspect data with:

```bash
npm run prisma:studio
```

## Auth and Access Model

- Authentication is handled with Supabase.
- Backend routes typically require a bearer token from the frontend session.
- Frontend protected areas are gated in `proxy.ts`.
- Role-specific enforcement also exists server-side through `lib/auth/server.ts`.

Current roles:

- `trainee`
- `coach`
- `admin`

## Engineering Notes

### Frontend conventions

- App Router pages live under `app/`.
- Feature-specific UI is grouped in `components/`.
- Shared request logic lives in `lib/auth/api.ts`, `lib/fitness/api.ts`, and `lib/admin/api.ts`.
- Localization messages live under `lib/i18n/messages/`.

### Backend conventions

- Keep HTTP concerns in `backend/src/routes/`.
- Keep business logic in `backend/src/services/`.
- Keep infra clients in `backend/src/lib/`.
- Treat `backend/prisma/schema.prisma` as the canonical data model.

## Known Gaps

These are worth keeping in mind while working in the repo:

- The current root `lint` script is broken because `eslint` is not installed in the root package.
- No automated test suite is currently set up.
- Both `package-lock.json` and `pnpm-lock.yaml` exist at the root, so package manager choice is ambiguous.
- `proxy.ts` protects the main app areas, while `/admin` relies on server-side role checks in the page itself.
- The old README content was deployment-focused and not sufficient as an engineering guide.

## Verification Snapshot

The following commands were verified successfully in this repo:

```bash
npm run build
npm --prefix backend run build
```

This command currently fails:

```bash
npm run lint
```

Failure reason:

```text
'eslint' is not recognized as an internal or external command
```

## Recommended Next Cleanup

If we want to keep tightening the repo, the highest-value follow-ups are:

1. Add and configure ESLint so `npm run lint` is real.
2. Pick one package manager and remove the other lockfile.
3. Add a minimal automated test strategy for frontend and backend smoke coverage.
4. Decide whether `/admin` should also be covered by `proxy.ts` for consistency.
