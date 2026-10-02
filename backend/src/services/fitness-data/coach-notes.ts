import type { SerializedProfile } from "../auth.service"
import { NotFoundError } from "../errors"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "./shared/guards"

/**
 * A coach's private notes about one of their trainees. Only the coach who wrote
 * a note reads, edits or deletes it; the trainee never sees them.
 */

type CoachNoteRecord = { body: string; createdAt: Date; id: string; updatedAt: Date }

export function serializeCoachNote(note: CoachNoteRecord, coachName: string) {
  return {
    body: note.body,
    coachName,
    createdAt: note.createdAt.toISOString(),
    id: note.id,
    updatedAt: note.updatedAt.toISOString(),
  }
}

const NOTE_SELECT = { body: true, createdAt: true, id: true, updatedAt: true } as const

export async function createCoachNote(profile: SerializedProfile, traineeId: string, body: string) {
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)
  const note = await ensurePrisma().coachNote.create({
    data: { body, coachId: profile.id, traineeId },
    select: NOTE_SELECT,
  })
  return serializeCoachNote(note, profile.name)
}

/** The coach's own note about this trainee, or a 404 — never someone else's. */
async function findOwnNote(profile: SerializedProfile, traineeId: string, noteId: string) {
  assertCoach(profile)
  const note = await ensurePrisma().coachNote.findFirst({
    select: { id: true },
    where: { coachId: profile.id, id: noteId, traineeId },
  })
  if (!note) throw new NotFoundError("Không tìm thấy ghi chú.")
  return note
}

export async function updateCoachNote(profile: SerializedProfile, traineeId: string, noteId: string, body: string) {
  await findOwnNote(profile, traineeId, noteId)
  const note = await ensurePrisma().coachNote.update({ data: { body }, select: NOTE_SELECT, where: { id: noteId } })
  return serializeCoachNote(note, profile.name)
}

export async function deleteCoachNote(profile: SerializedProfile, traineeId: string, noteId: string) {
  await findOwnNote(profile, traineeId, noteId)
  await ensurePrisma().coachNote.delete({ where: { id: noteId } })
  return { deleted: true, id: noteId }
}
