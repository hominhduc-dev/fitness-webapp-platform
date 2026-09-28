import { ExerciseShareStatus, Prisma, UserRole } from "@prisma/client"

import { serializeMuscleProfile } from "../../domain/muscle-profile"
import { serializeExerciseMedia } from "../../lib/exercise-media"
import { invalidateExerciseLibrary } from "../../lib/library-cache"
import type { SerializedProfile } from "../auth.service"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { notifyCoachOfExerciseShareReview, type ExerciseShareDecision } from "../notifications/exercise-share-notifications"

/**
 * The admin side of coach exercises offered to the shared library. An admin
 * approves one (everyone sees it, the coach keeps the credit), declines it (it
 * stays the coach's own), or merges it into the library exercise it duplicates:
 * every workout slot and trainee swap moves over, and the copy is deleted.
 */

const SHARE_REQUEST_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  variations: {
    include: { _count: { select: { workoutExercises: true } }, muscleTargets: true },
    omit: { metadata: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  },
} satisfies Prisma.ExerciseInclude

type ShareRequestRecord = Prisma.ExerciseGetPayload<{ include: typeof SHARE_REQUEST_INCLUDE }>

/** Exercises everyone sees: system ones and those an admin shared. */
const LIBRARY_EXERCISE_WHERE = {
  OR: [{ createdById: null }, { shareStatus: ExerciseShareStatus.shared }],
} satisfies Prisma.ExerciseWhereInput

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) {
    throw new ForbiddenError("Chỉ admin mới có quyền duyệt bài tập.")
  }
}

function serializeShareRequest(exercise: ShareRequestRecord) {
  return {
    coach: exercise.createdBy ? { id: exercise.createdBy.id, name: exercise.createdBy.name } : null,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    requestedAt: exercise.shareRequestedAt ?? exercise.updatedAt,
    usageCount: exercise.variations.reduce((sum, variation) => sum + variation._count.workoutExercises, 0),
    variations: exercise.variations.map((variation) => ({
      ...serializeMuscleProfile(variation),
      equipment: variation.equipment ?? undefined,
      id: variation.id,
      isDefault: variation.isDefault,
      media: serializeExerciseMedia(variation.displayMetadata),
      name: variation.name,
    })),
  }
}

/** Coach exercises waiting for a decision, oldest request first. */
export async function listAdminExerciseShareRequests(profile: SerializedProfile) {
  assertAdmin(profile)
  const exercises = await ensurePrisma().exercise.findMany({
    include: SHARE_REQUEST_INCLUDE,
    orderBy: [{ shareRequestedAt: "asc" }, { name: "asc" }],
    where: { createdById: { not: null }, shareStatus: ExerciseShareStatus.pending },
  })
  return exercises.map(serializeShareRequest)
}

type ShareReviewInput =
  | { decision: "approve"; note?: string }
  | { decision: "reject"; note?: string }
  | { decision: "merge"; note?: string; targetVariationId: string }

/**
 * Each variation of the coach's exercise moves to the target exercise's
 * variation of the same name, or else to the one the admin picked.
 */
export function mapMergedVariations(
  source: Array<{ id: string; name: string }>,
  target: { chosenVariationId: string; variations: Array<{ id: string; name: string }> },
) {
  const byName = new Map(target.variations.map((variation) => [variation.name.trim().toLowerCase(), variation.id]))
  return source.map((variation) => ({
    from: variation.id,
    to: byName.get(variation.name.trim().toLowerCase()) ?? target.chosenVariationId,
  }))
}

export async function reviewAdminExerciseShare(profile: SerializedProfile, exerciseId: string, input: ShareReviewInput) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const note = input.note?.trim() || null

  const exercise = await db.exercise.findUnique({
    include: { variations: { select: { id: true, name: true } } },
    where: { id: exerciseId },
  })
  if (!exercise || !exercise.createdById) {
    throw new NotFoundError("Không tìm thấy bài tập của coach.")
  }
  if (exercise.shareStatus !== ExerciseShareStatus.pending) {
    throw new ConflictError("Bài tập này đã được xử lý.")
  }

  const reviewed = { shareReviewNote: note, shareReviewedAt: new Date(), shareReviewedById: profile.id }
  let decision: ExerciseShareDecision
  let targetName: string | undefined
  let targetExerciseId: string | undefined

  if (input.decision === "merge") {
    const chosen = await db.variation.findUnique({
      include: { exercise: { include: { variations: { select: { id: true, name: true } } } } },
      where: { id: input.targetVariationId },
    })
    const inLibrary = chosen && (!chosen.exercise.createdById || chosen.exercise.shareStatus === ExerciseShareStatus.shared)
    if (!chosen || !inLibrary || chosen.exerciseId === exercise.id) {
      throw new BadRequestError("Chỉ gộp được vào một bài tập trong thư viện chung.")
    }

    const moves = mapMergedVariations(exercise.variations, {
      chosenVariationId: chosen.id,
      variations: chosen.exercise.variations,
    })
    await db.$transaction(async (tx) => {
      for (const { from, to } of moves) {
        await tx.workoutExercise.updateMany({ data: { variationId: to }, where: { variationId: from } })
        await tx.workoutExercise.updateMany({ data: { originalVariationId: to }, where: { originalVariationId: from } })
        await tx.traineeExerciseOverride.updateMany({ data: { variationId: to }, where: { variationId: from } })
        await tx.traineeExerciseOverride.updateMany({ data: { replacedVariationId: to }, where: { replacedVariationId: from } })
      }
      // Nothing points at the copy any more; the Restrict relations fail the
      // transaction if something was missed rather than orphan a workout.
      await tx.exercise.delete({ where: { id: exercise.id } })
    })
    decision = "merged"
    targetName = chosen.exercise.name
    targetExerciseId = chosen.exerciseId
  } else {
    await db.exercise.update({
      data: {
        ...reviewed,
        shareStatus: input.decision === "approve" ? ExerciseShareStatus.shared : ExerciseShareStatus.rejected,
      },
      where: { id: exercise.id },
    })
    decision = input.decision === "approve" ? "approved" : "rejected"
  }

  await db.adminAuditLog.create({
    data: {
      action: `exercise.share.${decision}`,
      adminId: profile.id,
      entityId: exercise.id,
      entityLabel: exercise.name,
      entityType: "exercise",
      metadata: { coachId: exercise.createdById, note, targetExerciseId: targetExerciseId ?? null } as Prisma.InputJsonObject,
    },
  })

  invalidateExerciseLibrary()
  void notifyCoachOfExerciseShareReview({
    coachId: exercise.createdById,
    decision,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    note,
    targetName,
  })

  return { decision, exerciseId: exercise.id, targetExerciseId: targetExerciseId ?? null }
}

export { LIBRARY_EXERCISE_WHERE }
