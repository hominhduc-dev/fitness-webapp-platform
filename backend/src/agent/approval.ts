import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { ensureContextPrisma } from "../services/ai/context/helpers"
import { ConflictError, ForbiddenError, NotFoundError } from "../services/errors"
import { resolveSubject, trackSubject } from "./security"

export const changesSchema = z.object({ subjectId: z.uuid(), programId: z.uuid(), reason: z.string().min(1).max(1000),
  changes: z.array(z.object({ setId: z.uuid(), targetReps: z.number().int().min(1).max(50).optional(),
    weight: z.number().min(0).max(1000).optional(), rir: z.number().int().min(0).max(10).optional() }).strict()
    .refine(value => value.targetReps != null || value.weight != null || value.rir != null)).max(50).default([]),
  setCounts: z.array(z.object({ workoutExerciseId: z.uuid(), count: z.number().int().min(1).max(10) }).strict()).max(20).default([]) }).strict()
  .refine(value => value.changes.length > 0 || value.setCounts.length > 0)
export const noteSchema = z.object({ subjectId: z.uuid(), body: z.string().min(1).max(2000) }).strict()
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]))
  return value
}
// JSONB may reorder object keys; hashes must survive storage and retrieval.
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
const programInclude = { assignments: { orderBy: { id: "asc" as const } }, workouts: { orderBy: { id: "asc" as const },
  include: { exercises: { orderBy: { id: "asc" as const }, include: { variation: { select: { name: true, exercise: { select: { name: true } } } }, sets: { orderBy: { setNumber: "asc" as const } }, traineeOverrides: { orderBy: { id: "asc" as const } } } } } } }

async function editableProgram(db: Prisma.TransactionClient, actorId: string, subjectId: string, programId: string) {
  const { actor } = await resolveSubject(actorId, subjectId, db)
  const program = await db.program.findUnique({ where: { id: programId }, include: programInclude })
  if (!program || program.archivedAt) throw new NotFoundError("Không tìm thấy program đang hoạt động.")
  if (program.createdById !== actor.id || program.assignments.some(item => item.userId !== subjectId) ||
    !program.assignments.some(item => item.userId === subjectId)) throw new ForbiddenError("Chỉ chỉnh program do bạn sở hữu và được giao riêng cho học viên này.")
  if (await db.workoutSessionDraft.count({ where: { userId: subjectId, workout: { programId } } })) throw new ConflictError("Học viên đang có phiên tập chưa kết thúc. Hãy hoàn tất hoặc bỏ phiên trước khi sửa program.")
  return program
}

export async function proposeChanges(actorId: string, runId: string, callId: string, args: unknown) {
  const input = changesSchema.parse(args)
  const db = ensureContextPrisma()
  return db.$transaction(async tx => {
    const existing = await tx.agentApproval.findUnique({ where: { runId_callId: { runId, callId } } })
    if (existing) return existing
    const run = await tx.agentRun.findUnique({ where: { id: runId }, include: { conversation: true } })
    if (run?.status !== "running" || run.conversation.actorId !== actorId) throw new ConflictError("Run đã dừng.")
    if (!(await tx.agentRun.updateMany({ where: { id: runId, status: "running", leaseToken: run.leaseToken }, data: { updatedAt: new Date() } })).count) throw new ConflictError("Run đã dừng.")
    const program = await editableProgram(tx, actorId, input.subjectId, input.programId)
    const sets = program.workouts.flatMap(workout => workout.exercises.flatMap(exercise => exercise.sets.map(set => ({ ...set, label: `${workout.name} · ${exercise.variation.exercise.name} (${exercise.variation.name}) #${set.setNumber}`, variationId: exercise.variationId }))))
    if (new Set(input.changes.map(item => item.setId)).size !== input.changes.length) throw new ConflictError("Set bị trùng.")
    const changes = input.changes.map(change => {
      const set = sets.find(item => item.id === change.setId)
      if (!set || set.completed) throw new ConflictError("Không được sửa set đã hoàn thành hoặc ngoài program.")
      const before = { targetReps: set.targetReps, weight: set.weight, rir: set.rir }
      const after = { ...before, ...Object.fromEntries(Object.entries(change).filter(([key, value]) => key !== "setId" && value !== undefined)) }
      if (set.targetRepsMin != null && after.targetReps < set.targetRepsMin) throw new ConflictError("Reps thấp hơn khoảng mục tiêu.")
      return { setId: set.id, label: set.label, variationId: set.variationId, before, after }
    })
    if (new Set(input.setCounts.map(item => item.workoutExerciseId)).size !== input.setCounts.length) throw new ConflictError("Exercise bị trùng.")
    const setCountChanges = input.setCounts.map(item => {
      const exercise = program.workouts.flatMap(workout => workout.exercises.map(exercise => ({ ...exercise, label: `${workout.name} · ${exercise.variation.exercise.name} (${exercise.variation.name})` }))).find(exercise => exercise.id === item.workoutExerciseId)
      if (!exercise || !exercise.sets.length || exercise.sets.some(set => set.completed)) throw new ConflictError("Không thể thay số set cho bài ngoài program hoặc đã hoàn thành.")
      if (input.changes.some(change => exercise.sets.slice(item.count).some(set => set.id === change.setId))) throw new ConflictError("Không thể chỉnh mục tiêu của set bị loại bỏ.")
      return { workoutExerciseId: exercise.id, label: exercise.label, beforeCount: exercise.sets.length, afterCount: item.count, beforeSets: exercise.sets }
    })
    const payload = { programId: program.id, programName: program.name, version: fingerprint(program), reason: input.reason, changes, setCountChanges }
    const approval = await tx.agentApproval.create({ data: { runId, callId, kind: "program_changes", subjectId: input.subjectId,
      payload: payload as Prisma.InputJsonValue, payloadHash: fingerprint(payload), expiresAt: new Date(Date.now() + 86_400_000) } })
    await tx.agentEvent.create({ data: { runId, type: "proposal.created", payload: { approvalId: approval.id, payloadHash: approval.payloadHash } } })
    return approval
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function proposeNote(actorId: string, runId: string, callId: string, args: unknown) {
  const input = noteSchema.parse(args)
  return ensureContextPrisma().$transaction(async tx => {
    const { actor } = await resolveSubject(actorId, input.subjectId, tx)
    if (actor.role !== "coach") throw new ForbiddenError("Chỉ coach được tạo ghi chú.")
    const run = await tx.agentRun.findUnique({ where: { id: runId }, include: { conversation: true } })
    if (run?.status !== "running" || run.conversation.actorId !== actorId) throw new ConflictError("Run đã dừng.")
    if (!(await tx.agentRun.updateMany({ where: { id: runId, status: "running", leaseToken: run.leaseToken }, data: { updatedAt: new Date() } })).count) throw new ConflictError("Run đã dừng.")
    const existing = await tx.agentApproval.findUnique({ where: { runId_callId: { runId, callId } } })
    if (existing) return existing
    return tx.agentApproval.create({ data: { runId, callId, kind: "coach_note", subjectId: input.subjectId,
      payload: input, payloadHash: fingerprint(input), expiresAt: new Date(Date.now() + 86_400_000) } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function decideApproval(actorId: string, approvalId: string, hash: string, approve: boolean) {
  const db = ensureContextPrisma()
  return db.$transaction(async tx => {
    const approval = await tx.agentApproval.findUnique({ where: { id: approvalId }, include: { run: { include: { conversation: true } } } })
    if (!approval || approval.run.conversation.actorId !== actorId) throw new NotFoundError("Không tìm thấy đề xuất.")
    await resolveSubject(actorId, approval.subjectId, tx)
    if (approval.payloadHash !== hash || fingerprint(approval.payload) !== hash) throw new ConflictError("Payload không khớp bản xem trước.")
    const targetStatus = approve ? "approved" : "rejected"
    if (approval.status === targetStatus) return { status: approval.status }
    if (approval.status !== "pending" || approval.expiresAt < new Date() || approval.run.status !== "waiting_approval") throw new ConflictError("Đề xuất đã hết hạn hoặc run không chờ duyệt.")
    if (!(await tx.agentRun.updateMany({ where: { id: approval.runId, status: "waiting_approval" }, data: { updatedAt: new Date() } })).count) throw new ConflictError("Run đã dừng.")
    let appliedVersion: string | undefined
    if (approve && approval.kind === "program_changes") {
      const payload = approval.payload as unknown as { programId: string; version: string; changes: Array<{ setId: string; before: { targetReps: number; weight: number | null; rir: number | null }; after: { targetReps: number; weight: number | null; rir: number | null } }>; setCountChanges?: SetCountChange[] }
      const program = await editableProgram(tx, actorId, approval.subjectId, payload.programId)
      if (fingerprint(program) !== payload.version) throw new ConflictError("Program đã thay đổi. Hãy tạo đề xuất mới.")
      const locked = await tx.program.updateMany({ where: { id: program.id, updatedAt: program.updatedAt }, data: { updatedAt: new Date() } })
      if (locked.count !== 1) throw new ConflictError("Program đã thay đổi.")
      for (const change of payload.changes) {
        const updated = await tx.exerciseSet.updateMany({ where: { id: change.setId, completed: false, ...change.before }, data: change.after })
        if (updated.count !== 1) throw new ConflictError("Set đã thay đổi.")
      }
      for (const change of payload.setCountChanges ?? []) {
        const exercise = program.workouts.flatMap(workout => workout.exercises).find(exercise => exercise.id === change.workoutExerciseId)
        if (!exercise || exercise.sets.length !== change.beforeCount || exercise.sets.some(set => set.completed)) throw new ConflictError("Số set đã thay đổi.")
        if (change.afterCount < change.beforeCount) {
          const removedIds = exercise.sets.slice(change.afterCount).map(set => set.id)
          const removed = await tx.exerciseSet.deleteMany({ where: { id: { in: removedIds }, workoutExerciseId: exercise.id, completed: false } })
          if (removed.count !== removedIds.length) throw new ConflictError("Set đã thay đổi.")
        } else if (change.afterCount > change.beforeCount) {
          const originalTemplate = exercise.sets[exercise.sets.length - 1]
          const targetChange = payload.changes.find(change => change.setId === originalTemplate.id)
          const template = { ...originalTemplate, ...targetChange?.after }
          const additions: Prisma.ExerciseSetCreateManyInput[] = []
          for (let index = change.beforeCount; index < change.afterCount; index++) {
            const source = change.restoreSets?.[index] ?? template
            additions.push({ ...(change.restoreSets?.[index] ? { id: source.id } : {}), workoutExerciseId: exercise.id, setNumber: index + 1,
              targetReps: source.targetReps, targetRepsMin: source.targetRepsMin, weight: source.weight, rir: source.rir, intensityTag: source.intensityTag, notes: source.notes, completed: false })
          }
          await tx.exerciseSet.createMany({ data: additions })
        }
      }
      appliedVersion = fingerprint(await tx.program.findUnique({ where: { id: program.id }, include: programInclude }))
    } else if (approve && approval.kind === "coach_note") {
      const { actor } = await resolveSubject(actorId, approval.subjectId, tx)
      if (actor.role !== "coach") throw new ForbiddenError("Chỉ coach được ghi chú.")
      const input = noteSchema.parse(approval.payload)
      await tx.coachNote.create({ data: { coachId: actorId, traineeId: approval.subjectId, body: input.body } })
    } else if (approve) throw new ConflictError("Loại đề xuất không được hỗ trợ.")
    const changed = await tx.agentApproval.updateMany({ where: { id: approval.id, status: "pending" }, data: { status: targetStatus, decidedAt: new Date() } })
    if (changed.count !== 1) throw new ConflictError("Đề xuất đã được xử lý.")
    await tx.agentEvent.create({ data: { runId: approval.runId, type: `approval.${targetStatus}`, payload: { approvalId, hash, beforeAfter: approval.payload, ...(appliedVersion ? { appliedVersion } : {}) } } })
    const pending = await tx.agentApproval.count({ where: { runId: approval.runId, status: "pending" } })
    if (!pending) await tx.agentRun.update({ where: { id: approval.runId }, data: { status: "queued", leaseToken: null, leaseUntil: null } })
    return { status: targetStatus }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

type SetCountChange = { workoutExerciseId: string; label: string; beforeCount: number; afterCount: number;
  beforeSets: Array<Prisma.ExerciseSetCreateManyInput & { id: string }>;
  restoreSets?: Array<Prisma.ExerciseSetCreateManyInput & { id: string }> }

/** Reverting creates another preview and approval; never silently undo newer edits. */
export async function proposeRevert(actorId: string, runId: string, callId: string, approvalId: string) {
  const db = ensureContextPrisma()
  const original = await db.agentApproval.findUnique({ where: { id: approvalId }, include: { run: { include: { conversation: true } } } })
  if (!original || original.status !== "approved" || original.kind !== "program_changes" || original.run.conversation.actorId !== actorId) throw new NotFoundError("Không tìm thấy thay đổi có thể hoàn tác.")
  const payload = original.payload as unknown as { programId: string; changes: Array<{ setId: string; before: { targetReps: number; weight: number | null; rir: number | null } }>; setCountChanges?: SetCountChange[] }
  await trackSubject(actorId, runId, original.subjectId)
  const audit = await db.agentEvent.findFirst({ where: { runId: original.runId, type: "approval.approved", payload: { path: ["approvalId"], equals: approvalId } }, orderBy: { id: "desc" } })
  const current = await editableProgram(db, actorId, original.subjectId, payload.programId)
  if ((audit?.payload as Record<string, unknown>)?.appliedVersion !== fingerprint(current)) throw new ConflictError("Program đã thay đổi sau lần duyệt. Không thể hoàn tác bản cũ.")
  // Null values can be restored through this internal path, while regular model inputs remain bounded.
  const existing = await db.agentApproval.findUnique({ where: { runId_callId: { runId, callId } } })
  if (existing) return existing
  return db.$transaction(async tx => {
    const program = await editableProgram(tx, actorId, original.subjectId, payload.programId)
    if (fingerprint(program) !== fingerprint(current)) throw new ConflictError("Program đã thay đổi.")
    const run = await tx.agentRun.findUnique({ where: { id: runId }, include: { conversation: true } })
    if (run?.status !== "running" || run.conversation.actorId !== actorId || !(await tx.agentRun.updateMany({ where: { id: runId, status: "running", leaseToken: run.leaseToken }, data: { updatedAt: new Date() } })).count) throw new ConflictError("Run đã dừng.")
    const sets = program.workouts.flatMap(workout => workout.exercises.flatMap(exercise => exercise.sets.map(set => ({ ...set, label: `${workout.name} · ${exercise.variation.exercise.name} (${exercise.variation.name}) #${set.setNumber}`, variationId: exercise.variationId }))))
    const changes = payload.changes.map(change => {
      const set = sets.find(item => item.id === change.setId)
      if (!set || set.completed) throw new ConflictError("Set không còn có thể chỉnh.")
      return { setId: set.id, label: set.label, variationId: set.variationId, before: { targetReps: set.targetReps, weight: set.weight, rir: set.rir }, after: change.before }
    })
    const setCountChanges = (payload.setCountChanges ?? []).map(change => ({ workoutExerciseId: change.workoutExerciseId, label: change.label, beforeCount: change.afterCount, afterCount: change.beforeCount, beforeSets: [], restoreSets: change.beforeSets }))
    const inverse = { programId: program.id, programName: program.name, version: fingerprint(program), reason: `Hoàn tác thay đổi ${approvalId}`, changes, setCountChanges }
    return tx.agentApproval.create({ data: { runId, callId, kind: "program_changes", subjectId: original.subjectId, payload: inverse,
      payloadHash: fingerprint(inverse), expiresAt: new Date(Date.now() + 86_400_000) } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
