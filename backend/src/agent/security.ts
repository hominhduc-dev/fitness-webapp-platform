import type { Prisma } from "@prisma/client"
import { ensureContextPrisma } from "../services/ai/context/helpers"
import type { SerializedProfile } from "../services/auth.service"
import { serializeProfile } from "../services/auth/core"
import { ForbiddenError } from "../services/errors"

export async function resolveSubject(actorId: string, subjectId: string, db: Prisma.TransactionClient = ensureContextPrisma()) {
  const [actor, subject] = await Promise.all([db.user.findUnique({ where: { id: actorId } }), db.user.findUnique({ where: { id: subjectId } })])
  if (!actor?.isActive || !subject?.isActive || subject.role !== "trainee" ||
    !(actor.role === "trainee" && actor.id === subject.id || actor.role === "coach" && subject.coachId === actor.id && actor.coachApprovalStatus === "approved")) {
    throw new ForbiddenError("Bạn không còn quyền truy cập học viên này.")
  }
  return { actor: serializeProfile(actor) as SerializedProfile, subject: serializeProfile(subject) as SerializedProfile }
}

export async function requireActor(actorId: string, db: Prisma.TransactionClient = ensureContextPrisma()) {
  const actor = await db.user.findUnique({ where: { id: actorId } })
  if (!actor?.isActive || !(actor.role === "trainee" || actor.role === "coach" && actor.coachApprovalStatus === "approved")) throw new ForbiddenError("Không có quyền dùng agent.")
  return serializeProfile(actor) as SerializedProfile
}

export async function trackSubject(actorId: string, runId: string, subjectId: string) {
  await resolveSubject(actorId, subjectId)
  const db = ensureContextPrisma()
  const run = await db.agentRun.findFirst({ where: { id: runId, status: "running", conversation: { actorId } }, select: { subjectIds: true } })
  if (!run) throw new ForbiddenError("Run không còn hoạt động.")
  if (!run.subjectIds.includes(subjectId)) await db.agentRun.updateMany({ where: { id: runId, status: "running" }, data: { subjectIds: { push: subjectId } } })
}
