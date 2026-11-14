import { Prisma } from "@prisma/client"
import { z } from "zod"
import { ensureContextPrisma } from "../services/ai/context/helpers"
import { ConflictError, NotFoundError, TooManyRequestsError } from "../services/errors"
import { requireActor, resolveSubject } from "./security"
import type { AIConversationMessage } from "../lib/ai/types"
import type { AgentRunContext, Checkpoint } from "./runtime/checkpoint"
import { getRequestContext } from "../lib/logger"

const runContextSchema = z.object({ subjectId: z.uuid().optional(), programId: z.uuid().optional() }).strict()
export const createRunSchema = z.object({ message: z.string().trim().min(1).max(4000), conversationId: z.uuid().optional(), requestKey: z.uuid(), context: runContextSchema.optional() }).strict()

/** Client-selected subject/program is only a hint: re-check access and resolve display names server-side. */
async function resolveRunContext(actorId: string, input: z.infer<typeof runContextSchema> | undefined, tx: Prisma.TransactionClient): Promise<AgentRunContext | undefined> {
  if (!input?.subjectId && !input?.programId) return undefined
  const { subject } = await resolveSubject(actorId, input.subjectId ?? actorId, tx)
  const context: AgentRunContext = { subjectId: subject.id, subjectName: subject.name ?? "" }
  if (!input.programId) return context
  const program = await tx.program.findFirst({ where: { id: input.programId, archivedAt: null, assignments: { some: { userId: subject.id } } }, select: { id: true, name: true } })
  if (!program) throw new NotFoundError("Không tìm thấy giáo án của học viên này.")
  return { ...context, programId: program.id, programName: program.name }
}

/** Names-only pickers for the agent composer, so users never type IDs. */
export async function listContextOptions(actorId: string, subjectId?: string) {
  const actor = await requireActor(actorId)
  const db = ensureContextPrisma()
  const subjects = actor.role === "coach"
    ? await db.user.findMany({ where: { coachId: actorId, isActive: true, role: "trainee" }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true } })
    : [{ id: actor.id, name: actor.name ?? "" }]
  const target = subjectId ?? (actor.role === "trainee" ? actor.id : undefined)
  if (!target) return { subjects, programs: [] }
  const { subject } = await resolveSubject(actorId, target)
  const programs = await db.program.findMany({ where: { archivedAt: null, assignments: { some: { userId: subject.id } } }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true } })
  return { subjects, programs }
}
export async function createRun(actorId: string, input: z.infer<typeof createRunSchema>) {
  await requireActor(actorId)
  const db = ensureContextPrisma()
  return db.$transaction(async tx => {
    const existing = await tx.agentRun.findUnique({ where: { requestKey: `${actorId}:${input.requestKey}` }, include: { conversation: true } })
    if (existing) return { id: existing.id, conversationId: existing.conversationId, status: existing.status }
    if (await tx.agentRun.count({ where: { conversation: { actorId }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) >= 30) throw new TooManyRequestsError("Đã chạm giới hạn 30 lượt agent trong 24 giờ.")
    let conversation = input.conversationId ? await tx.agentConversation.findFirst({ where: { id: input.conversationId, actorId } }) : null
    if (input.conversationId && !conversation) throw new NotFoundError("Không tìm thấy hội thoại.")
    const context = await resolveRunContext(actorId, input.context, tx)
    if (!conversation) conversation = await tx.agentConversation.create({ data: { actorId, title: (context?.subjectName && context.subjectId !== actorId ? `${context.subjectName} · ${input.message}` : input.message).slice(0, 80) } })
    const previousSubjects = await tx.agentRun.findMany({ where: { conversationId: conversation.id }, select: { subjectIds: true } })
    for (const subjectId of new Set(previousSubjects.flatMap(run => run.subjectIds))) await resolveSubject(actorId, subjectId, tx)
    if (await tx.agentRun.count({ where: { conversationId: conversation.id, status: { in: ["queued", "running", "waiting_approval"] } } })) throw new ConflictError("Hội thoại đang có lượt xử lý chưa hoàn tất.")
    const history = await tx.agentMessage.findMany({ where: { conversationId: conversation.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12 })
    const messages: AIConversationMessage[] = history.reverse().map(item => ({ role: item.role as "user" | "assistant", content: item.content }))
    messages.push({ role: "user", content: input.message })
    const checkpoint: Checkpoint = { messages, startedAt: Date.now(), timeZone: getRequestContext()?.timeZone ?? "Asia/Ho_Chi_Minh", ...(context ? { context } : {}) }
    const run = await tx.agentRun.create({ data: { conversationId: conversation.id, requestKey: `${actorId}:${input.requestKey}`, checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      ...(context && context.subjectId !== actorId ? { subjectIds: [context.subjectId] } : {}) } })
    await tx.agentMessage.create({ data: { conversationId: conversation.id, role: "user", content: input.message } })
    await tx.agentConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })
    await tx.agentEvent.create({ data: { runId: run.id, type: "run.queued", payload: {} } })
    return { id: run.id, conversationId: conversation.id, status: run.status }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function getOwnedRun(actorId: string, runId: string) {
  await requireActor(actorId)
  const run = await ensureContextPrisma().agentRun.findFirst({ where: { id: runId, conversation: { actorId } },
    include: { approvals: { orderBy: { createdAt: "asc" } } } })
  if (!run) throw new NotFoundError("Không tìm thấy lượt xử lý.")
  for (const subjectId of run.subjectIds) await resolveSubject(actorId, subjectId)
  return run
}
export async function cancelRun(actorId: string, runId: string) {
  await requireActor(actorId)
  if (!await ensureContextPrisma().agentRun.findFirst({ where: { id: runId, conversation: { actorId } }, select: { id: true } })) throw new NotFoundError("Không tìm thấy lượt xử lý.")
  return ensureContextPrisma().$transaction(async tx => {
    const changed = await tx.agentRun.updateMany({ where: { id: runId, status: { in: ["queued", "running", "waiting_approval"] } }, data: { status: "cancelled", leaseToken: null, leaseUntil: null } })
    if (changed.count) {
      await tx.agentApproval.updateMany({ where: { runId, status: "pending" }, data: { status: "rejected", decidedAt: new Date() } })
      await tx.agentEvent.create({ data: { runId, type: "run.cancelled", payload: {} } })
    }
    return { status: "cancelled" }
  })
}
export async function listConversations(actorId: string) {
  await requireActor(actorId)
  return ensureContextPrisma().agentConversation.findMany({ where: { actorId }, orderBy: { updatedAt: "desc" }, take: 30,
    select: { id: true, title: true, updatedAt: true } })
}
export async function readConversation(actorId: string, id: string) {
  await requireActor(actorId)
  const item = await ensureContextPrisma().agentConversation.findFirst({ where: { id, actorId },
    include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 }, runs: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } } } })
  if (!item) throw new NotFoundError("Không tìm thấy hội thoại.")
  const subjects = await ensureContextPrisma().agentRun.findMany({ where: { conversationId: id }, select: { subjectIds: true } })
  for (const subjectId of new Set(subjects.flatMap(run => run.subjectIds))) await resolveSubject(actorId, subjectId)
  return { ...item, messages: item.messages.reverse() }
}
export const memorySchema = z.object({ key: z.enum(["report_format", "training_preferences", "equipment", "weekly_review_enabled"]), content: z.string().trim().min(1).max(500) }).strict()
export async function listMemories(actorId: string) { await requireActor(actorId); return ensureContextPrisma().agentMemory.findMany({ where: { actorId }, orderBy: { key: "asc" } }) }
export async function saveMemory(actorId: string, input: z.infer<typeof memorySchema>) {
  const actor = await requireActor(actorId)
  if (input.key === "weekly_review_enabled" && (actor.role !== "coach" || !["true", "false"].includes(input.content))) throw new ConflictError("Chỉ coach được cấu hình báo cáo tuần.")
  return ensureContextPrisma().agentMemory.upsert({ where: { actorId_key: { actorId, key: input.key } }, create: { actorId, ...input }, update: { content: input.content, source: "user_explicit" } })
}
