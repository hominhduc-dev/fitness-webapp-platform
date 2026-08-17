import { z } from "zod"

import { AppError } from "../services/errors"

const EXERCISE_ACTIVITY_TYPES = ["strength", "cardio", "mobility", "sport", "other"] as const

const MUSCLE_SLUGS = [
  "abs",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "forearm",
  "gluteal",
  "hamstring",
  "lower-back",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
  "upper-back",
] as const

const exerciseActivityTypeSchema = z.enum(EXERCISE_ACTIVITY_TYPES)
const muscleSlugSchema = z.enum(MUSCLE_SLUGS)

const muscleProfileInputSchema = z
  .object({
    activityType: exerciseActivityTypeSchema,
    primaryMuscles: z.array(muscleSlugSchema).max(MUSCLE_SLUGS.length),
    secondaryMuscles: z.array(muscleSlugSchema).max(MUSCLE_SLUGS.length).default([]),
  })
  .superRefine((profile, context) => {
    const primarySet = new Set(profile.primaryMuscles)
    const secondarySet = new Set(profile.secondaryMuscles)

    if (primarySet.size !== profile.primaryMuscles.length) {
      context.addIssue({
        code: "custom",
        message: "Primary muscles không được trùng nhau.",
        path: ["primaryMuscles"],
      })
    }

    if (secondarySet.size !== profile.secondaryMuscles.length) {
      context.addIssue({
        code: "custom",
        message: "Secondary muscles không được trùng nhau.",
        path: ["secondaryMuscles"],
      })
    }

    const overlap = profile.secondaryMuscles.find((slug) => primarySet.has(slug))
    if (overlap) {
      context.addIssue({
        code: "custom",
        message: `${overlap} không thể vừa là primary vừa là secondary.`,
        path: ["secondaryMuscles"],
      })
    }

    if (profile.activityType === "strength" && profile.primaryMuscles.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Bài strength phải có ít nhất một primary muscle.",
        path: ["primaryMuscles"],
      })
    }
  })

type ExerciseActivityTypeValue = (typeof EXERCISE_ACTIVITY_TYPES)[number]
type MuscleProfileInput = z.infer<typeof muscleProfileInputSchema>
type MuscleSlugValue = (typeof MUSCLE_SLUGS)[number]

type MuscleTargetRecord = {
  muscleSlug: string
  position: number
  role: "primary" | "secondary"
}

type MuscleProfileRecord = {
  activityType: ExerciseActivityTypeValue | null
  muscleProfileConfidence: number | null
  muscleProfileRationale: string | null
  muscleProfileSource: "ai" | "manual" | null
  muscleProfileStatus: "pending" | "approved"
  muscleTargets: MuscleTargetRecord[]
}

const LEGACY_GROUP_TARGETS: Record<string, readonly MuscleSlugValue[]> = {
  arms: ["biceps", "triceps", "forearm"],
  back: ["upper-back", "lower-back", "trapezius"],
  calves: ["calves"],
  chest: ["chest"],
  core: ["abs", "obliques"],
  glutes: ["gluteal"],
  legs: ["quadriceps", "hamstring", "gluteal", "calves", "adductors"],
  shoulders: ["deltoids", "trapezius"],
}

function legacyMuscleGroupToSlugs(muscleGroup: string | null | undefined): readonly MuscleSlugValue[] {
  const key = muscleGroup?.trim().toLowerCase()
  return key ? LEGACY_GROUP_TARGETS[key] ?? [] : []
}

function legacyMuscleGroupsForSlug(slug: MuscleSlugValue) {
  return Object.entries(LEGACY_GROUP_TARGETS)
    .filter(([, slugs]) => slugs.includes(slug))
    .map(([group]) => group)
}

function parseMuscleProfileInput(value: unknown): MuscleProfileInput {
  const result = muscleProfileInputSchema.safeParse(value)

  if (!result.success) {
    throw new AppError("Muscle profile không hợp lệ.", {
      code: "INVALID_MUSCLE_PROFILE",
      details: result.error.flatten(),
      status: 400,
    })
  }

  return result.data
}

function parseMuscleListValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
  }

  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  }

  return []
}

function buildMuscleTargetRows(profile: MuscleProfileInput) {
  return [
    ...profile.primaryMuscles.map((muscleSlug, position) => ({ muscleSlug, position, role: "primary" as const })),
    ...profile.secondaryMuscles.map((muscleSlug, position) => ({ muscleSlug, position, role: "secondary" as const })),
  ]
}

function buildApprovedMuscleProfileData(profile: MuscleProfileInput, reviewedById?: string) {
  return {
    activityType: profile.activityType,
    muscleProfileConfidence: null,
    muscleProfileRationale: null,
    muscleProfileReviewedAt: new Date(),
    muscleProfileReviewedById: reviewedById ?? null,
    muscleProfileSource: "manual" as const,
    muscleProfileStatus: "approved" as const,
    muscleTargets: {
      create: buildMuscleTargetRows(profile),
    },
  }
}

function buildApprovedMuscleProfileUpdate(profile: MuscleProfileInput, reviewedById?: string) {
  return {
    activityType: profile.activityType,
    muscleProfileConfidence: null,
    muscleProfileRationale: null,
    muscleProfileReviewedAt: new Date(),
    muscleProfileReviewedById: reviewedById ?? null,
    muscleProfileSource: "manual" as const,
    muscleProfileStatus: "approved" as const,
    muscleTargets: {
      create: buildMuscleTargetRows(profile),
      deleteMany: {},
    },
  }
}

function serializeMuscleProfile(record: MuscleProfileRecord) {
  const byPosition = (left: MuscleTargetRecord, right: MuscleTargetRecord) => left.position - right.position

  return {
    activityType: record.activityType ?? undefined,
    muscleProfileConfidence: record.muscleProfileConfidence ?? undefined,
    muscleProfileRationale: record.muscleProfileRationale ?? undefined,
    muscleProfileSource: record.muscleProfileSource ?? undefined,
    muscleProfileStatus: record.muscleProfileStatus,
    primaryMuscles: record.muscleTargets
      .filter((target) => target.role === "primary")
      .sort(byPosition)
      .map((target) => target.muscleSlug as MuscleSlugValue),
    secondaryMuscles: record.muscleTargets
      .filter((target) => target.role === "secondary")
      .sort(byPosition)
      .map((target) => target.muscleSlug as MuscleSlugValue),
  }
}

function serializePublicMuscleProfile(record: MuscleProfileRecord, legacyMuscleGroup?: string | null) {
  const serialized = serializeMuscleProfile(record)
  if (record.muscleProfileStatus === "approved") {
    return {
      activityType: serialized.activityType,
      primaryMuscles: serialized.primaryMuscles,
      secondaryMuscles: serialized.secondaryMuscles,
    }
  }

  return {
    activityType: serialized.activityType,
    primaryMuscles: [...legacyMuscleGroupToSlugs(legacyMuscleGroup)],
    secondaryMuscles: [] as MuscleSlugValue[],
  }
}

export {
  buildApprovedMuscleProfileData,
  buildApprovedMuscleProfileUpdate,
  buildMuscleTargetRows,
  EXERCISE_ACTIVITY_TYPES,
  exerciseActivityTypeSchema,
  MUSCLE_SLUGS,
  muscleProfileInputSchema,
  muscleSlugSchema,
  legacyMuscleGroupToSlugs,
  legacyMuscleGroupsForSlug,
  parseMuscleProfileInput,
  parseMuscleListValue,
  serializeMuscleProfile,
  serializePublicMuscleProfile,
}
export type { ExerciseActivityTypeValue, MuscleProfileInput, MuscleProfileRecord, MuscleSlugValue, MuscleTargetRecord }
