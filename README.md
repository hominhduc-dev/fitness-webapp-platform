# YeahBuddy Fitness

> A full-stack fitness platform for lifters and their coaches — log workouts, track meals and body weight, follow coach-authored programs, and manage everything from a single dashboard.

YeahBuddy is a monorepo containing two applications:

- **Frontend** — a Next.js 16 (App Router) web app in the repository root.
- **Backend** — a standalone Express + Prisma API in [`backend/`](backend/).

Authentication is handled by **Supabase Auth**, and all application data lives in **PostgreSQL** (hosted on Supabase) accessed through **Prisma**. The frontend never talks to the database directly — it proxies API calls to the Express backend, which owns all business logic and role enforcement.

---

## Table of Contents

- [Overview](#overview)
- [Roles](#roles)
- [Features by area](#features-by-area)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Routes](#routes)
  - [Frontend routes by role](#frontend-routes-by-role)
  - [Rendering strategy](#rendering-strategy)
  - [Backend API endpoints](#backend-api-endpoints)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Conventions & ground rules](#conventions--ground-rules)
- [Auth & access model](#auth--access-model)

---

## Overview

YeahBuddy connects two kinds of users:

- **Trainees** log their training and nutrition, follow a program assigned by a coach (or train on their own), and watch their progress over time.
- **Coaches** author training programs, assign them to trainees, monitor compliance, leave feedback on logged sessions, and run check-ins.

An **admin** role sits on top for platform operations (user management, coach↔trainee connections, the shared exercise library, and audit logs).

The product is **Vietnamese-facing** (UI copy and API error messages are localized; an English/Vietnamese locale toggle is built in), while the codebase, comments, and docs are in English.

---

## Roles

Three roles are defined in the `UserRole` enum and enforced **server-side** via `requireAppSession()` (frontend route guards) and `assertTrainee` / `assertCoach` / `assertAdmin` (backend service guards).

| Role | Landing page | Can do |
|---|---|---|
| **trainee** | `/dashboard` | Log workouts & meals, track body weight, follow assigned programs, view progress analytics, discover and request a coach |
| **coach** | `/coach` | Author & assign programs, manage an exercise library, monitor trainees, comment on logged workouts, run check-ins, approve coach requests |
| **admin** | `/admin` | Manage users & roles, coach↔trainee connections, the global exercise/food library, and review audit logs |

A signed-out visitor only sees the **landing page** (`/`) and the auth modal. After login, users are redirected to their role's landing page.

---

## Features by area

- **Workouts** — Build personal workouts or follow coach-assigned program days; an in-session logger with set/rep/weight tracking, a rest timer, and automatic PR detection; full workout history.
- **Nutrition** — Daily meal logging backed by a food database (Vietnamese foods + USDA FoodData Central), per-meal items, and calorie/macro targets with a live "calories left" view.
- **Body metrics** — Weekly weigh-ins plus optional measurements (waist, arms, body fat, etc.).
- **Progress analytics** — Volume, frequency, estimated 1RM, a training calendar, and a year view.
- **Coaching** — Program authoring & assignment, trainee compliance dashboards, at-risk flagging, workout-log comments, and structured check-ins.
- **Admin** — Platform health metrics, user/role management, connection management, library curation, and audit logging.
- **Cross-cutting** — Supabase email/password + OAuth (Google/Apple), password reset, avatar uploads to Supabase Storage, in-app notifications, and EN/VI localization.

---

## Tech stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI primitives
- **Forms:** Controlled React components (no React Hook Form/Zod on the client)
- **Charts:** Recharts · **Drag & drop:** @dnd-kit
- **Utilities:** date-fns, clsx, tailwind-merge, lucide-react
- **Auth client:** `@supabase/ssr` (cookie-based SSR sessions)

### Backend
- **Runtime:** Node.js + Express 4 + TypeScript
- **ORM:** Prisma 6 · **Database:** PostgreSQL (Supabase, via PgBouncer pooler)
- **Auth:** Supabase Auth (token verification + user-metadata sync)
- **External data:** USDA FoodData Central API

---

## Architecture

```
┌──────────────────────┐     /backend/api/*  (rewrite)      ┌──────────────────────┐
│   Next.js frontend    │ ─────────────────────────────────▶│   Express API (:4000)│
│   (App Router, :3000) │                                    │   Prisma + services  │
│                       │ ◀──────────────────────────────────│                      │
└──────────┬────────────┘        { data, error, meta }       └──────────┬───────────┘
           │                                                            │
           │  cookie session (@supabase/ssr)                            │  Prisma
           ▼                                                            ▼
   ┌───────────────┐                                          ┌───────────────────┐
   │ Supabase Auth │                                          │ PostgreSQL on     │
   └───────────────┘                                          │ Supabase (pooler) │
                                                              └───────────────────┘
```

- The browser calls `/backend/api/...`, which Next.js rewrites to the Express server (`NEXT_PUBLIC_API_URL`).
- Every authenticated request carries the Supabase access token; the backend verifies it, syncs a local `User` profile, and enforces role before running a handler.
- API responses follow a consistent `{ data, error, meta }` envelope (auth endpoints return a flatter `{ profile, session, user }` payload).

---

## Repository layout

```text
.
├── app/                      # Next.js App Router (pages, layouts, route handlers)
│   ├── (shell)/              # Authenticated app shell (sidebar + role pages)
│   ├── auth/callback/        # OAuth / email-confirmation callback route handler
│   ├── reset-password/       # Password reset page
│   └── page.tsx              # Public landing page
├── components/               # Feature UI + shared shadcn/ui primitives
│   ├── auth/  landing/  layout/  coach/  dashboard/  ...
├── hooks/                    # Reusable React hooks
├── lib/                      # Frontend auth, API clients, i18n, types
├── public/                   # Static assets
├── backend/
│   ├── prisma/               # schema.prisma + migrations
│   └── src/
│       ├── routes/           # Express routers (one per resource)
│       ├── services/         # Business logic (auth, fitness-data, admin, nutrition…)
│       ├── lib/              # Prisma client, Supabase clients
│       ├── config/           # env parsing
│       └── scripts/          # create-admin, seed-* scripts
├── CLAUDE.md                 # Project config & ground rules for AI/dev tooling
└── README.md
```

---

## Routes

### Frontend routes by role

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page + auth modal (`?auth=login` / `?auth=register`) |
| `/auth/callback` | Public | OAuth / email-confirmation callback (exchanges code → session) |
| `/reset-password` | Public (token) | Set a new password after a reset email |
| `/profile` | Any authenticated | Account & profile settings, avatar upload |
| `/dashboard` | **trainee** | Today's training, nutrition & progress summary |
| `/schedule` | **trainee** | Rolling weekly training schedule |
| `/workout` | **trainee** | Saved / personal workouts list |
| `/workout/[id]/start` | **trainee** | In-session workout logger (sets, reps, rest timer, PRs) |
| `/meals` | **trainee** | Daily meal log + calorie/macro targets |
| `/progress` | **trainee** | Progress analytics (volume, 1RM, calendar) |
| `/trackweight` | **trainee** | Body-weight & measurement tracking |
| `/coach/find` | **trainee** | Discover and request a coach |
| `/coach` | **coach** | Coach workspace dashboard (compliance, recent logs, at-risk) |
| `/coach/trainees` | **coach** | Trainee list |
| `/coach/trainees/[id]` | **coach** | Single trainee detail (logs, metrics, check-ins) |
| `/coach/programs` | **coach** | Programs the coach authored |
| `/coach/programs/new` | **coach** | Program builder (create) |
| `/coach/programs/[id]` | **coach** | Program editor (edit / assign / adjust per trainee) |
| `/coach/exercises` | **coach** | Coach exercise library + import |
| `/admin` | **admin** | Platform overview, user management, library, audit logs |

### Rendering strategy

| Route group | Strategy |
|---|---|
| `app/page.tsx`, `(shell)/layout.tsx` | SSR — auth redirect |
| `(shell)/dashboard`, `coach/`, `workout/`, `schedule/` | SSR + Suspense streaming (`force-dynamic`) |
| `(shell)/coach/exercises`, `coach/find`, `coach/trainees/[id]` | Hybrid — SSR fetch → CSR client component |
| `(shell)/profile`, `meals/`, `progress/`, `trackweight/` | CSR (`"use client"`, hooks) |
| `reset-password/`, `workout/[id]/start/` | CSR |

### Backend API endpoints

All endpoints are mounted under `/api`. Auth is required for everything except `/api/health/*` and the public auth endpoints (`register`, `login`, `refresh`, `forgot-password`).

<details>
<summary><b>Auth</b> — <code>/api/auth</code></summary>

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | Public | Email/username/phone + password sign-up |
| POST | `/login` | Public | Login by email, username, or phone |
| POST | `/refresh` | Public | Refresh a session |
| POST | `/forgot-password` | Public | Send a reset email (no account enumeration) |
| GET | `/me` | Authed | Current profile |
| PATCH | `/me` | Authed | Update profile |
| POST | `/me/avatar` | Authed | Upload avatar to Supabase Storage |
| POST | `/me/reset-trainee-data` | trainee | Wipe own training/nutrition data |
| POST | `/logout` | Authed | Sign out current device |
</details>

<details>
<summary><b>Trainee</b> — workouts, meals, foods, progress, dashboard, exercises, notifications</summary>

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Trainee dashboard payload |
| GET | `/api/workouts` · `/api/workouts/logs` | Saved workouts + log history |
| GET / POST / PATCH / DELETE | `/api/workouts/:workoutId` | Read / create / edit / delete a personal workout |
| POST | `/api/workouts/:workoutId/logs` | **Finish (log) a workout** |
| DELETE | `/api/workouts/:workoutId/logs/:logId` | Delete a logged session |
| GET | `/api/meals?date=` | Daily nutrition (meals + totals + targets) |
| POST | `/api/meals/items` | **Log a meal item** |
| DELETE | `/api/meals/items/:itemId` | Remove a logged item |
| GET / POST | `/api/foods` | Search / create foods |
| GET | `/api/progress/analytics` | Volume / frequency / 1RM analytics |
| GET / POST | `/api/progress/weight` | Body-weight entries |
| GET | `/api/progress/calendar` · `/year-view` | Training calendar & year heatmap |
| GET | `/api/progress/workout-log/:logId` | Single log detail |
| GET | `/api/exercises` · `/api/exercises/library` | Exercise & variation library |
| GET | `/api/notifications` | In-app notifications |
| PATCH / POST | `/api/notifications/:id/read` · `/read-all` | Mark read |
</details>

<details>
<summary><b>Coach</b> — <code>/api/coach</code></summary>

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/dashboard` · `/nav-counts` | coach | Workspace dashboard & sidebar counts |
| GET / POST | `/programs` | coach | List / create programs |
| GET / PATCH / DELETE | `/programs/:programId` | coach | Read / edit / delete a program |
| POST / DELETE | `/programs/:programId/assignments[/:traineeId]` | coach | Assign / unassign a program |
| POST | `/programs/:programId/adjustments` | coach | Per-trainee program tweaks |
| GET / POST / PATCH / DELETE | `/exercises…`, `/exercise-import-requests` | coach | Coach exercise library + import |
| GET | `/trainees` · `/trainees/:id` · `/trainees/:id/workout-logs` | coach | Trainee list / detail / logs |
| POST | `/trainees/:id/body-metrics` · `/check-ins` | coach | Record metrics / check-ins |
| POST / PATCH / DELETE | `/workout-logs/:id/comments`, `/workout-log-comments/:id` | coach | Feedback on logged sessions |
| GET | `/discover` | trainee | Browse available coaches |
| POST | `/requests` | trainee | Request a coach |
| PATCH | `/requests/:requestId` | coach | Approve / reject a request |
</details>

<details>
<summary><b>Admin</b> — <code>/api/admin</code> (admin only)</summary>

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Platform metrics |
| GET / PATCH | `/users`, `/users/:id` | List & update users (role / active state) |
| POST | `/users/:id/reset-password` | Force a password reset |
| GET / PATCH / DELETE | `/coach-requests…` | Moderate coach requests |
| GET / POST / DELETE | `/connections…` | Manage coach↔trainee connections |
| GET / DELETE | `/programs…` | Review / delete programs |
| GET / POST / PATCH / DELETE | `/exercises…`, `/exercise-import-requests…`, `/exercise-groups` | Curate the exercise library |
| GET | `/audit-logs` | Admin action audit trail |
</details>

<details>
<summary><b>Health</b> — <code>/api/health</code> (public)</summary>

`GET /api/health`, `/api/health/database`, `/api/health/supabase` — service, DB, and Supabase connectivity checks.
</details>

---

## Data model

The Prisma schema lives in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Core models:

| Domain | Models |
|---|---|
| **Identity** | `User` (role, profile, goals, coach link) |
| **Exercise library** | `Exercise`, `Variation`, `ExerciseImportRequest` |
| **Programs** | `Program`, `ProgramAssignment`, `Workout`, `WorkoutExercise`, `ExerciseSet` |
| **Training logs** | `WorkoutLog`, `WorkoutLogComment` |
| **Body & coaching** | `BodyMetricEntry`, `CoachCheckIn`, `CoachRequest` |
| **Nutrition** | `Food`, `Meal`, `MealFoodItem` |
| **Platform** | `Notification`, `AdminAuditLog` |

Enums: `UserRole`, `ProgramDifficulty`, `MealType`, `WorkoutKind`, `CoachRequestStatus`, `ExerciseImportRequestStatus`, `WeightUnit`, `FoodSource`, `FoodCategory`, `NotificationType`, `NotificationChannel`, `NotificationStatus`.

Every schema change ships with a migration file under `backend/prisma/migrations/`.

---

## Getting started

### Prerequisites

- **Node.js** 20+ and **npm**
- A **Supabase** project (Auth + PostgreSQL). You need the project URL, anon key, and service-role key, plus the database connection strings.

### 1. Install dependencies

```bash
npm install                    # frontend deps (repo root)
npm install --prefix backend   # backend deps
```

### 2. Configure environment

**Frontend** — create `.env.local` (see `.env.local.example`):

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

**Backend** — create `backend/.env`:

```bash
# Database (Supabase Postgres)
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres   # PgBouncer (pooled)
DIRECT_URL=postgresql://...supabase.co:5432/postgres            # direct (migrations)

# Supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App
PORT=4000
FRONTEND_URL=http://localhost:3000

# Optional: USDA FoodData Central (nutrition search)
USDA_API_KEY=<your-key>
# USDA_API_BASE_URL=https://api.nal.usda.gov/fdc/v1
# USDA_TIMEOUT_MS=8000
```

> Never commit `.env` files or secrets. The service-role key must stay server-side only.

### 3. Set up the database

```bash
npm run prisma:generate            # generate Prisma client
npm run prisma:migrate             # apply migrations (dev)

# Seed reference data (optional):
npm --prefix backend run seed:exercises
npm --prefix backend run seed:foods

# Create the first admin user:
npm run create:admin
```

### 4. Run the apps

```bash
npm run dev          # Next.js frontend → http://localhost:3000
npm run dev:backend  # Express API     → http://localhost:4000
```

Open http://localhost:3000 and sign up / log in.

> **Auth email note:** registration and password reset require Supabase email delivery. Configure **custom SMTP** in the Supabase dashboard (Authentication → Emails), or temporarily disable email confirmation for local testing — otherwise sign-up fails at the "send confirmation email" step.

---

## Scripts

### Root (frontend)

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server (`:3000`) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run dev:backend` · `build:backend` · `start:backend` | Proxy to backend scripts |
| `npm run create:admin` | Create an admin account |
| `npm run prisma:generate` · `migrate` · `push` · `studio` · `validate` | Prisma (proxied to backend) |
| `npm run splash` | Generate iOS splash assets |

### Backend

| Script | Description |
|---|---|
| `npm --prefix backend run dev` | `tsx watch` API server |
| `npm --prefix backend run build` / `start` | Compile / run `dist` |
| `npm --prefix backend run seed:exercises` / `seed:foods` | Seed reference data |
| `npm --prefix backend run create:admin` | Create an admin user |
| `npm --prefix backend run prisma:*` | `generate` · `migrate` · `push` · `studio` · `validate` |

---

## Conventions & ground rules

1. All backend API responses use the `{ data, error, meta }` envelope.
2. Every route raises a typed `AppError` / `AuthServiceError` — never a raw `Error`.
3. Prisma for all database access — no raw SQL except in migration files.
4. Frontend components use **named** exports, not default exports.
5. Every database change ships with a migration file.
6. Commits follow **Conventional Commits** (`type(scope): description`).
7. Never commit `.env`, credentials, or secrets.
8. Server components fetch via server-side API calls; the service-role key is never exposed to the client.

---

## Auth & access model

- **Sessions** are Supabase Auth tokens stored in cookies via `@supabase/ssr`. The frontend forwards the access token to the backend on every API call.
- The backend **verifies the token**, syncs a local `User` profile (auto-provisioned from Supabase metadata on first sight), and **enforces the role** before running any handler. A short-lived per-token cache avoids re-verifying on every request in a burst.
- Role guards: `requireAppSession({ role })` on the frontend redirects unauthorized users; `assertTrainee` / `assertCoach` / `assertAdmin` on the backend reject them with a typed error.
- **OAuth** (Google/Apple) and **email/password** are both supported, plus password reset and avatar uploads to Supabase Storage.

---

<sub>Built with Next.js, Express, Prisma, and Supabase. UI localized for Vietnamese with an EN/VI toggle.</sub>
