import { UserRole } from "@prisma/client"

import { prisma } from "../../../lib/prisma"
import { ForbiddenError, NotFoundError, AppError } from "../../errors"
import type { SerializedProfile } from "../../auth.service"

/**
 * Authorization and precondition guards for the fitness-data services.
 *
 * Role enforcement lives here rather than in the route layer so that a service
 * called from anywhere — an HTTP handler, an AI tool call, a script — cannot skip
 * it. See CLAUDE.md, "Auth & access model".
 */

/** `prisma` is null when DATABASE_URL is absent; every query path funnels through here. */
function ensurePrisma() {
  if (!prisma) {
    throw new AppError("Database is not configured.", { code: "DATABASE_NOT_CONFIGURED", status: 500 })
  }

  return prisma
}

function assertCoach(profile: SerializedProfile) {
  if (profile.role !== UserRole.coach) {
    throw new ForbiddenError("Chỉ coach mới có quyền truy cập dữ liệu này.")
  }
}

function assertTrainee(profile: SerializedProfile) {
  if (profile.role !== UserRole.trainee) {
    throw new ForbiddenError("Chỉ trainee mới có quyền truy cập dữ liệu này.")
  }
}

/**
 * Returns 404 rather than 403 on purpose: a coach must not be able to probe which
 * trainee ids exist by comparing status codes.
 */
async function assertCoachOwnsTrainee(coachId: string, traineeId: string) {
  const db = ensurePrisma()
  const trainee = await db.user.findFirst({
    where: {
      coachId,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new NotFoundError("Không tìm thấy trainee thuộc coach này.")
  }

  return trainee
}

export { assertCoach, assertCoachOwnsTrainee, assertTrainee, ensurePrisma }
