# YeahBuddy Agent — phases 2–4

Implemented on top of Phase 1. The legacy `/api/ai/chat` and program/meal draft acceptance routes remain available. The new agent is accessible through the Agent tab in trainee chat, `/agent`, and the coach dashboard's AI Agent link.

## Available behavior

- Compare two adjacent 7–60-day periods using completed actual sets and the existing e1RM helper. Group by program ID and stable variation ID. Require three exposures per period and complete RIR for a moderate-confidence screening signal. Prescribed reps/RIR/set structure changes lower confidence. Missing IDs, non-strength activity and invalid sets are excluded. This is screening, not a clinical or definitive plateau diagnosis.
- Propose target reps, weight, RIR and set counts (1–10 per exercise) for uncompleted program sets. Show before/after values. Set-count increases copy the last prescribed set; decreases remove only the uncompleted tail. Only the program creator can change a program assigned exclusively to the selected trainee. Open sessions block changes. Shared templates, assignment changes, exercise substitutions and completed logs are outside this initial write scope.
- Approve/reject with a canonical payload hash, expiry, live relationship checks, aggregate program fingerprint and serializable transaction. All changed targets and before/after values are audited. Reverts create another preview requiring approval and refuse programs edited since the original approval.
- Store conversations and messages on the server. New runs use server-owned history; client-supplied transcripts are not accepted by the new API.
- Explicit user memories for report format, equipment and training preferences. The model cannot save memories or access another user's memories. Users can replace/delete preferences. Fitness values are always fetched afresh.
- PostgreSQL queue with atomic claims, 90-second renewable leases, persisted model/tool checkpoints, replay of saved tool results and recovery after expired leases. API and worker can share a process or run separately.
- SSE progress metadata, event replay by ID, polling fallback, cancellation and graceful worker shutdown. No model reasoning is streamed. SSE does not expose raw tool results.
- Coach tools for paginated roster/review and draft private follow-up notes. Each subject is authorized at execution and approval. Stored run/history access and future context reuse also recheck tracked subjects after coach reassignment.
- Optional weekly coach reports. Off by default; opt in under Saved preferences. Scheduling uses existing weekly review notification settings and timezone. A deterministic weekly key prevents duplicate runs. Reports are stored in conversation history; this feature does not send a new notification. A report uses normal quota and may cover only part of a large roster; it must report coverage.

## Runtime limits and operational details

8 model turns, 20 tool attempts, 20,000 conservatively estimated/provider-reported tokens per run. 180-second timeout per worker attempt, at most 5 claims including approval resumes. Model requests receive an AbortSignal. Database reads have bounded waits (usually 15 seconds, 60 seconds for a five-trainee review); the underlying Prisma query is not forcibly cancelled. No speculative write is allowed after cancellation. Draft transactions are awaited rather than raced.

Context compaction evicts replaceable large tool data and old plain turns. It retains tool-call protocol groups, current requests, failures and approval payloads. Evicted values must be reread. This implementation does not generate model-written conversation summaries or semantic/vector memory retrieval.

History uses small pages; program previews read one workout at a time. Oversized results produce an explicit structured error. Model requests are not automatically retried after ambiguous errors because the provider may already have billed tokens. Expired worker leases resume checkpoints, with a bounded claim count. Serializable approval conflicts are surfaced to the caller instead of silently retrying a changed proposal.

30 runs per actor per rolling 24 hours, stored in the database. Phase 1's RAM draft counters remain unchanged in the legacy chat. Logs/events record model, prompt version, step/call counts, token usage and tool input/result. Optional `AGENT_USD_PER_MILLION_TOKENS` sets a blended cost estimate; this is not provider billing. New tables enable RLS and revoke public Data API privileges; access goes through authenticated Express and Prisma.

## Enable locally or deploy

1. Review and apply `backend/prisma/migrations/20261008090000_agent_runtime/migration.sql` to the intended development/staging database using `npm --prefix backend run prisma:deploy`. Use a backend DB role that is permitted to access the RLS-protected tables (the same privileged server role used by the app).
2. Generate Prisma: `npm --prefix backend run prisma:generate`.
3. Configure the existing provider credentials and model. Set `AGENT_ENABLED=true` for the API and `AGENT_WORKER_ENABLED=true` for the process running the worker. In a single backend process, the worker flag also enables run creation.
4. Start the normal frontend/backend. For a separate worker, leave `AGENT_WORKER_ENABLED=false` in the API process and run `npm --prefix backend run dev:agent-worker` with that flag set to `true` in the worker process. Production: build backend, then `npm --prefix backend run start:agent-worker`.
5. Verify trainee `/agent`, the dashboard Agent tab, coach `/agent`, proposal approval/rejection/revert, reconnect/resume, and optional weekly reports. Do not enable scheduling until the target database has the migration.

This change ships migration source; it does not apply migrations to the currently configured database. The current development connection at `127.0.0.1:55432` needs the repository's SSH tunnel (`npm run dev:backend`) before live database checks can run. Read-only connectivity verification during implementation could not reach that port.

## Verification

Verified 2026-10-08: backend full suite **878 passed, 8 skipped**; workspace UI suite **5 passed**. Backend/frontend production builds and typechecks, Prisma generate/validate, changed-file ESLint, semantic color checks and `git diff --check` passed. The canonical Vietnamese SRS/report is [`ai-features-report.tex`](ai-features-report.tex); the built-in LaTeX compiler could not prepare its preview (`helper_unknown_error: setup refresh had errors`), so PDF compilation/visual verification remains pending.

Tests cover variation/program separation, insufficient evidence, prescription changes, live relationship revocation, stale/hash-mismatched/expired approvals, idempotent decisions, shared-program protection, checkpoints, cached tool replay, budget rejection, cancellation, SSE data minimization, weekly schedule/deduplication and the before/after approval UI.

Use backend typecheck/build/full tests; frontend typecheck/build, targeted component tests, ESLint and `npm run lint:colors`. Mocked tests do not establish live provider/database E2E, transaction behavior on a deployed database or authenticated mobile/desktop visual validation. Those require the migrated development environment.
