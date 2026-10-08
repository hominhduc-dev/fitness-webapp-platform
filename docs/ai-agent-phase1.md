# YeahBuddy Agent Runtime — Phase 1

Follow-on implementation: [phases 2–4](ai-agent-phases-2-4.md). The Phase 1 legacy endpoint remains available; the durable agent uses separate authenticated routes and a restricted proposal workflow.

The existing trainee chat now supports multiple dependent tool turns through a bounded foreground runtime. Fitness services remain authoritative for numbers. No new write tools, database schema, routes, worker or frontend are introduced.

## Flow

The existing authenticated chat endpoint builds context, exposes the allowed tools for a trainee, runs the model/tool loop, and returns the existing `{ reply, action? }` service result. The route retains the application's response envelope. Program/meal draft tools retain their daily quotas, one successful draft per message, and existing user acceptance flow. A saved draft is returned even when a later provider turn fails.

New read tools:

| Tool | Source and coverage |
| --- | --- |
| `get_training_recommendation` | Existing today's recommendation service, including program-aware overload and volume decisions |
| `get_readiness` | Current week's recovery engine, confidence and guidance |
| `get_muscle_volume` | Current week's volume engine, across programs; today program-specific recommendations come from the recommendation tool |
| `get_workout_history` | Completed sessions over 1–60 days, default 28; latest 30 logs with total count, program IDs, actual sets and server-calculated Epley e1RM |
| `get_progression_summary` | Existing 60-day context summary, at most 80 logs and six exercise labels |
| `get_nutrition_summary` | Existing today/14-day nutrition context |

Tools reject extra parameters with strict Zod schemas. The authenticated server profile determines identity. There is no model-controlled user ID, SQL tool, cross-trainee access or new permission to mutate programs/logs. Non-trainee profiles receive no tools.

## Execution limits

Eight model turns, twenty tool calls, 20,000 estimated/provider-reported tokens for the chat loop, 16,000 characters per tool result, and a 45-second cooperative deadline. A tool batch exceeding the remaining call budget is rejected before execution. An oversized result becomes a structured error instead of silently truncated JSON. Tool errors exposed to the model omit internal exception details.

The deadline prevents starting more work, but does not cancel an in-flight provider or database request. Existing nested draft generations have their separate quotas and are outside the runtime token estimate. This foreground runtime is not durable and cannot resume after process restart. Completion logs record actor, status, turns, call count and token usage; they are not persistent per-tool audit records.

## Analysis constraints

History results explicitly report sampling limits. e1RM is calculated only for completed sets with actual reps and weight, using the app's existing helper and RIR adjustment. The progression summary is not a plateau diagnosis. Comparisons must account for variation, reps, RIR and program changes; missing coverage should lower confidence. A comprehensive plateau/program-change analyzer remains future work.

Client-supplied chat history, RAM daily counters and existing context loading remain unchanged. Retrieved results are treated as untrusted data in system instructions; instructions in notes or names do not grant tool permissions.

## Verification

Run `npm --prefix backend run prisma:generate`, `npm --prefix backend run typecheck` and `npm --prefix backend test`. Added tests exercise dependent tool turns, forged tool names, step/token/call budgets, safe tool failures, oversized outputs, role checks and attempts to supply another user's ID.

Live provider/database end-to-end verification requires a configured development environment. No production data is changed by this implementation.

## Next increments

Add stable variation-aware period comparisons and program revision history before a dedicated plateau tool; then server-owned conversation state, persisted run/tool events, approval payload/version checks, cancellation, worker checkpoints and SSE. Coach tools require live relationship authorization on each execution and are intentionally not exposed here.
