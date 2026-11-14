import { z } from "zod"
import type { AIToolCall, AIToolDefinition } from "../../lib/ai/types"
import { ensureContextPrisma } from "../../services/ai/context/helpers"
import { trainingReadTools, executeTrainingReadTool } from "./training.tools"
import { comparePeriods } from "../analytics"
import { getVolumeRecoveryForTrainee } from "../../services/volume-recovery/volume-recovery.service"
import { parseWorkoutLogSnapshotExercises } from "../../services/fitness-data/shared/workout-snapshot"
import { calculateE1RM } from "../../services/fitness-data/shared/e1rm"
import { requireActor, resolveSubject, trackSubject } from "../security"
import { changesSchema, noteSchema, proposeChanges, proposeNote, proposeRevert } from "../approval"

type ToolContext = { actorId: string; runId: string }
type Tool = { definition: AIToolDefinition; schema: z.ZodType; mode: "read" | "draft"; timeoutMs: number;
  execute: (ctx: ToolContext, args: Record<string, unknown>, callId: string) => Promise<unknown> }
const subjectSchema = z.object({ subjectId: z.uuid().optional() }).strict()
const periodSchema = z.object({ subjectId: z.uuid().optional(), days: z.number().int().min(7).max(60).default(28) }).strict()
const tools: Tool[] = trainingReadTools.map(definition => ({
  definition: { ...definition, parameters: { ...definition.parameters, properties: { ...(definition.parameters.properties as object), subjectId: { type: "string", format: "uuid" } } } },
  schema: definition.name === "get_workout_history" ? z.object({ subjectId: z.uuid().optional(), days: z.number().int().min(1).max(60).default(28) }).strict() : subjectSchema,
  mode: "read", timeoutMs: 15_000,
  execute: async (ctx, args, callId) => {
    const { subject } = await resolveSubject(ctx.actorId, String(args.subjectId ?? ctx.actorId))
    const { subjectId: _subjectId, ...rest } = args
    return executeTrainingReadTool(subject, { id: callId, name: definition.name, arguments: rest })
  },
}))
// The durable agent uses small history pages; the legacy endpoint retains Phase 1 behavior.
const historyTool = tools.find(tool => tool.definition.name === "get_workout_history")!
historyTool.schema = z.object({ subjectId: z.uuid().optional(), days: z.number().int().min(1).max(60).default(28), before: z.iso.datetime().optional(), limit: z.number().int().min(1).max(5).default(3) }).strict()
historyTool.definition = { name: "get_workout_history", description: "Read paginated completed workout history, at most five sessions per page; defaults to three. Reports sample limits and nextBefore. Each session returns up to six exercises and six sets per exercise. Use compare_training_periods for aggregate analysis.", parameters: z.toJSONSchema(historyTool.schema) }
historyTool.execute = async (ctx, args) => {
  const { subject } = await resolveSubject(ctx.actorId, String(args.subjectId ?? ctx.actorId))
  const db = ensureContextPrisma(), now = new Date(), since = new Date(now.getTime() - Number(args.days) * 86_400_000)
  const before = args.before ? new Date(String(args.before)) : now
  const where = { userId: subject.id, completedAt: { not: null, lte: now }, startedAt: { gte: since, lt: before < now ? before : now } }
  const [logs, total] = await Promise.all([db.workoutLog.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: Number(args.limit), select: { id: true, startedAt: true, programId: true, exerciseSnapshot: true } }), db.workoutLog.count({ where })])
  const pages = logs.map(log => { const exercises = parseWorkoutLogSnapshotExercises(log.exerciseSnapshot); return { id: log.id, startedAt: log.startedAt, programId: log.programId, exercisesLimited: exercises.length > 6,
    exercises: exercises.slice(0, 6).map(exercise => ({ exercise: exercise.exercise?.name, variation: exercise.variation ? { id: exercise.variation.id, name: exercise.variation.name } : null, setsLimited: (exercise.sets?.length ?? 0) > 6,
      sets: exercise.sets?.slice(0, 6).map(set => ({ completed: set.completed, reps: set.actualReps, weight: set.weight, rir: set.rir,
        e1rm: set.completed && typeof set.weight === "number" && typeof set.actualReps === "number" ? calculateE1RM(set.weight, set.actualReps, set.rir) : null })) })) } })
  // Shrink the page instead of failing: the worker rejects tool output over 12k chars, and weaker models do not retry narrower.
  while (pages.length > 1 && JSON.stringify(pages).length > 10_000) pages.pop()
  const limited = total > pages.length
  return { totalRemaining: total, limited, nextBefore: limited ? pages[pages.length - 1]?.startedAt.toISOString() ?? null : null, logs: pages }
}

const add = (name: string, description: string, schema: z.ZodType, mode: Tool["mode"], execute: Tool["execute"]) => {
  tools.push({ definition: { name, description, parameters: z.toJSONSchema(schema) }, schema, mode, timeoutMs: mode === "draft" ? 20_000 : 15_000, execute })
}
for (const name of ["compare_training_periods", "analyze_plateau"]) add(name,
  "Compare two adjacent periods using actual completed sets and engine e1RM for stable variation IDs within the same program. Plateau is only a screening signal; review readiness, program changes, RIR and missing data.", periodSchema, "read", async (ctx, args) => {
    const { subject } = await resolveSubject(ctx.actorId, String(args.subjectId ?? ctx.actorId))
    const days = Number(args.days), now = new Date(), db = ensureContextPrisma()
    const where = { userId: subject.id, completedAt: { not: null, lte: now }, startedAt: { gte: new Date(now.getTime() - days * 2 * 86_400_000), lte: now } }
    const [logs, total] = await Promise.all([db.workoutLog.findMany({ where, orderBy: { startedAt: "desc" }, take: 120,
      select: { id: true, startedAt: true, programId: true, exerciseSnapshot: true } }), db.workoutLog.count({ where })])
    return comparePeriods(logs, now, days, total > logs.length)
  })
add("get_program_for_proposal", "Read an assigned program with stable set IDs and current target reps, weight and RIR. Needed before proposing changes.",
  z.object({ subjectId: z.uuid().optional(), programId: z.uuid(), workoutId: z.uuid().optional() }).strict(), "read", async (ctx, args) => {
    const { subject } = await resolveSubject(ctx.actorId, String(args.subjectId ?? ctx.actorId))
    return { scope: "One workout, at most 12 exercises and 12 sets each. Choose workoutId from list_assigned_programs; results are sampled.", program: await ensureContextPrisma().program.findFirst({ where: { id: String(args.programId), assignments: { some: { userId: subject.id } }, archivedAt: null },
      select: { id: true, name: true, updatedAt: true, createdById: true, workouts: { where: args.workoutId ? { id: String(args.workoutId) } : {}, orderBy: { id: "asc" }, take: 1,
        select: { id: true, name: true, exercises: { orderBy: { order: "asc" }, take: 12, select: { id: true, variationId: true, sets: { orderBy: { setNumber: "asc" }, take: 12, select: { id: true, setNumber: true, targetReps: true, targetRepsMin: true, weight: true, rir: true, completed: true } } } } } } } }) }
  })
add("list_assigned_programs", "List active programs assigned to the authenticated trainee or an authorized coach's trainee.", subjectSchema, "read", async (ctx, args) => {
  const { subject } = await resolveSubject(ctx.actorId, String(args.subjectId ?? ctx.actorId))
  return { limited: true, programs: await ensureContextPrisma().program.findMany({ where: { assignments: { some: { userId: subject.id } }, archivedAt: null }, take: 20, orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdById: true, workouts: { take: 30, orderBy: { id: "asc" }, select: { id: true, name: true } } } }) }
})
add("propose_program_changes", "Create a preview only. Target reps/weight/RIR and setCounts (1–10 per exercise) require explicit approval. Added sets copy the last prescribed set; decreases remove only uncompleted tail sets. Use evidence for changes. Never change completed logs, shared programs or open sessions. Only personally owned programs assigned to a single subject are editable.", changesSchema, "draft",
  (ctx, args, callId) => proposeChanges(ctx.actorId, ctx.runId, callId, args))
add("draft_coach_note", "Draft a private coach follow-up/check-in note for review. Approval is required to save it.", noteSchema, "draft",
  (ctx, args, callId) => proposeNote(ctx.actorId, ctx.runId, callId, args))
add("propose_revert_program_changes", "On explicit user request, create an approval preview reversing an earlier approved program change. Refuses programs edited since that approval. Never immediately applies a revert.", z.object({ approvalId: z.uuid() }).strict(), "draft",
  (ctx, args, callId) => proposeRevert(ctx.actorId, ctx.runId, callId, String(args.approvalId)))
add("list_my_trainees", "Coach only. Paginated active assigned trainees. Use cursor to inspect the next page; never claim this is the full roster if nextCursor exists.",
  z.object({ cursor: z.uuid().optional() }).strict(), "read", async (ctx, args) => {
    const actor = await requireActor(ctx.actorId)
    if (actor.role !== "coach") return { ok: false, code: "FORBIDDEN" }
    const rows = await ensureContextPrisma().user.findMany({ where: { coachId: actor.id, role: "trainee", isActive: true },
      orderBy: { id: "asc" }, take: 21, ...(args.cursor ? { cursor: { id: String(args.cursor) }, skip: 1 } : {}), select: { id: true, name: true } })
    return { trainees: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null }
  })
add("coach_weekly_review", "Coach only: review at most five assigned trainees per page. Compare two 21-day periods, read readiness and draft follow-up separately. This is screening, never a definitive plateau diagnosis. Report nextCursor and coverage.",
  z.object({ cursor: z.uuid().optional() }).strict(), "read", async (ctx, args) => {
    const actor = await requireActor(ctx.actorId)
    if (actor.role !== "coach") return { ok: false, code: "FORBIDDEN" }
    const db = ensureContextPrisma(), now = new Date()
    const roster = await db.user.findMany({ where: { coachId: actor.id, role: "trainee", isActive: true }, orderBy: { id: "asc" }, take: 6,
      ...(args.cursor ? { cursor: { id: String(args.cursor) }, skip: 1 } : {}), select: { id: true, name: true } })
    const reviews = []
    for (const trainee of roster.slice(0, 5)) {
      await trackSubject(ctx.actorId, ctx.runId, trainee.id)
      const { subject } = await resolveSubject(actor.id, trainee.id)
      const where = { userId: subject.id, completedAt: { not: null, lte: now }, startedAt: { gte: new Date(now.getTime() - 42 * 86_400_000), lte: now } }
      const [logs, total, recovery] = await Promise.all([db.workoutLog.findMany({ where, take: 120, orderBy: { startedAt: "desc" },
        select: { id: true, programId: true, startedAt: true, exerciseSnapshot: true } }), db.workoutLog.count({ where }), getVolumeRecoveryForTrainee(subject)])
      const analysis = comparePeriods(logs, now, 21, total > logs.length)
      reviews.push({ subjectId: subject.id, name: trainee.name, readiness: recovery.readiness, confidence: recovery.confidence,
        limited: analysis.limited, signals: analysis.comparisons.map(({ key, label, signal, changePercent, confidence, prescriptionChanged }) => ({ key, label, signal, changePercent, confidence, prescriptionChanged })) })
    }
    return { reviews, nextCursor: roster.length > 5 ? roster[4].id : null, coverage: roster.slice(0, 5).map(item => item.id) }
  })

export async function allowedTools(actorId: string) {
  const actor = await requireActor(actorId)
  return tools.filter(tool => actor.role === "coach" || !["list_my_trainees", "draft_coach_note", "coach_weekly_review"].includes(tool.definition.name)).map(tool => tool.definition)
}
const weeklyReview = tools.find(tool => tool.definition.name === "coach_weekly_review")
if (weeklyReview) weeklyReview.timeoutMs = 60_000
export function getTool(name: string) { return tools.find(tool => tool.definition.name === name) }
export async function executeRegisteredTool(ctx: ToolContext, call: AIToolCall) {
  const actor = await requireActor(ctx.actorId)
  const tool = getTool(call.name)
  if (!tool) return { ok: false, code: "UNKNOWN_TOOL" }
  if (actor.role !== "coach" && ["list_my_trainees", "draft_coach_note", "coach_weekly_review"].includes(call.name)) return { ok: false, code: "FORBIDDEN" }
  const parsed = tool.schema.safeParse(call.arguments)
  if (!parsed.success) return { ok: false, code: "INVALID_ARGUMENTS" }
  const args = parsed.data as Record<string, unknown>
  // A trainee cannot select a different user, even before service dispatch.
  if (actor.role === "trainee" && args.subjectId && args.subjectId !== actor.id) return { ok: false, code: "FORBIDDEN" }
  if (typeof args.subjectId === "string") await trackSubject(actor.id, ctx.runId, args.subjectId)
  else if (actor.role === "trainee") await trackSubject(actor.id, ctx.runId, actor.id)
  return tool.execute(ctx, args, call.id)
}
