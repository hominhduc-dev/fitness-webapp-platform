# Backend

Standalone Express + TypeScript backend for the fitness app.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Prisma + Supabase

1. Copy `backend/.env.example` to `backend/.env`
2. Fill in `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`
3. Optionally set `N8N_LOGS_WEBHOOK_URL` to export workout logs to an n8n webhook.
4. Validate the Prisma setup:

```bash
npm run prisma:validate
```

5. Generate Prisma client:

```bash
npm run prisma:generate
```

6. Push the schema to Supabase Postgres:

```bash
npm run prisma:push
```

Useful commands:

```bash
npm run prisma:migrate
npm run prisma:studio
```

## Default API

- `GET /`
- `GET /api`
- `GET /api/health`
- `GET /api/health/database`
- `GET /api/health/supabase`

## Auth Email Delivery

- Signup confirmation and forgot-password emails are sent by Supabase.
- If you need custom SMTP, configure it in your Supabase project instead of this backend.

## Export Workout Logs to Google Sheets via n8n

1. In n8n, create a workflow with a `Webhook` trigger using `POST`.
2. Add a `Split Out` node for `body.rows`.
3. Add a `Google Sheets` node and choose `Append Row`.
4. Create sheet columns for `startedAt`, `plannedDate`, `traineeName`, `coachName`, `workoutName`, `exerciseName`, `setNumber`, `targetReps`, `actualReps`, `weight`, `rir`, `completed`, `totalVolume`, and `notes`.
5. Map each split row field to those columns.
6. Copy the production webhook URL into `backend/.env`:

```env
N8N_LOGS_WEBHOOK_URL=https://your-n8n-domain/webhook/workout-logs
```

Trainees can export from Progress. Coaches can export from trainee workout logs or program log export.
