# User feedback

Trainees, coaches and admins can send bug reports or suggestions from **Settings → Báo lỗi / Góp ý** (`/profile`). They can view their own submission history and details. Admins manage reports at `/admin?s=feedback`, filter by category/status, and move a report between `new`, `in_progress` and `resolved`.

## Data and access

- Description: 10–3000 characters. Optional PNG/JPEG/WebP attachment: up to 1 MiB, with server-side signature validation.
- Only the internal pathname is submitted; query strings and fragments are removed. The app version uses `NEXT_PUBLIC_APP_VERSION`, falling back to the package version. The backend records a bounded browser user-agent header.
- Attachments are stored with the report in PostgreSQL and returned only by its authenticated detail endpoint. List endpoints exclude attachments. Reports are visible to their owner and admins; only admins can change status.
- The migration enables RLS and revokes public/anon/authenticated table access. Prisma uses the existing privileged backend connection. The browser never accesses this table directly through the Supabase Data API.
- Status changes require `expectedUpdatedAt`; a stale update returns HTTP 409 with `FEEDBACK_STALE`.
- Submission endpoints use the existing heavy-request limiter and a per-account limit of 10 reports per 10 minutes.

## API

All endpoints use the existing `{ data, error, meta }` envelope and require an access token.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/feedback` | Signed-in user |
| GET | `/api/feedback/mine?page=1&limit=20` | Own reports |
| GET | `/api/feedback?status=new&category=bug&page=1&limit=20` | Admin |
| GET | `/api/feedback/:id` | Owner or admin |
| PATCH | `/api/feedback/:id` | Admin; body `{ status, expectedUpdatedAt }` |

Frontend requests use the existing `/backend` proxy. No email notification is sent.

## Deployment and verification

Apply `20261013090000_user_feedback` using `npm run prisma:deploy` and regenerate the backend Prisma client with `npm run prisma:generate`. Stop local dev servers before regeneration on Windows.

Focused backend tests: `npx vitest run src/routes/feedback.schemas.test.ts src/routes/feedback.route.test.ts src/services/feedback.service.test.ts` from `backend`.

Frontend tests: `npx vitest run components/settings/feedback-form.test.tsx components/admin/feedback-panel.test.tsx` from the repository root.

Real PostgreSQL check: `npx tsx src/scripts/test-feedback-postgres.ts` from `backend`, with the configured database tunnel available. This creates UUID-scoped test users/reports, checks private attachments, ownership and simultaneous status updates, then deletes only those fixtures in `finally`.
