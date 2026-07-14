import type { Prisma } from "@prisma/client"

import { prisma } from "../../../lib/prisma"
import { AuthServiceError } from "../../errors"
import type { ContextSection, ContextSectionKey } from "./types"

export type ContextPrismaClient = NonNullable<typeof prisma>

export type SnapshotSet = {
  actualReps?: number | null
  completed?: boolean | null
  rir?: number | null
  setNumber?: number | null
  targetReps?: number | null
  targetRepsMin?: number | null
  weight?: number | null
}

export type SnapshotExercise = {
  exercise?: {
    muscleGroup?: string | null
    name?: string | null
  } | null
  sets?: SnapshotSet[] | null
  variation?: {
    name?: string | null
  } | null
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

export function ensureContextPrisma(): ContextPrismaClient {
  if (!prisma) {
    throw new AuthServiceError("Database connection not available.", 500)
  }

  return prisma
}

export function estimateTokens(content: string) {
  return Math.max(1, Math.ceil(content.length / 4))
}

export function createSection(
  key: ContextSectionKey,
  title: string,
  priority: number,
  lines: string[],
): ContextSection | null {
  const content = lines.filter(Boolean).join("\n").trim()

  if (!content) {
    return null
  }

  return {
    content,
    key,
    priority,
    title,
    tokenEstimate: estimateTokens(content),
  }
}

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function startOfLocalDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

export function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function weekdayLabel(day?: number | null) {
  return typeof day === "number" ? WEEKDAY_LABELS[day] ?? `Ngày ${day}` : "Chưa lên lịch"
}

export function formatNumber(value?: number | null, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a"
  }

  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

export function summarizeText(value?: string | null, maxLength = 180) {
  const normalized = value?.trim().replace(/\s+/g, " ")

  if (!normalized) {
    return ""
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parseSnapshotSet(value: unknown): SnapshotSet | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    actualReps: toNumber(value.actualReps),
    completed: typeof value.completed === "boolean" ? value.completed : undefined,
    rir: toNumber(value.rir),
    setNumber: toNumber(value.setNumber),
    targetReps: toNumber(value.targetReps),
    targetRepsMin: toNumber(value.targetRepsMin),
    weight: toNumber(value.weight),
  }
}

export function parseExerciseSnapshot(snapshot: Prisma.JsonValue | null | undefined): SnapshotExercise[] {
  if (!Array.isArray(snapshot)) {
    return []
  }

  const exercises: SnapshotExercise[] = []

  for (const entry of snapshot) {
    if (!isRecord(entry)) {
      continue
    }

    const exercise = isRecord(entry.exercise) ? entry.exercise : null
    const variation = isRecord(entry.variation) ? entry.variation : null
    const sets = Array.isArray(entry.sets)
      ? entry.sets.map(parseSnapshotSet).filter((set): set is SnapshotSet => Boolean(set))
      : []

    exercises.push({
      exercise: exercise
        ? {
            muscleGroup: typeof exercise.muscleGroup === "string" ? exercise.muscleGroup : undefined,
            name: typeof exercise.name === "string" ? exercise.name : undefined,
          }
        : undefined,
      sets,
      variation: variation
        ? {
            name: typeof variation.name === "string" ? variation.name : undefined,
          }
        : undefined,
    })
  }

  return exercises
}

export function snapshotExerciseLabel(exercise: SnapshotExercise) {
  const exerciseName = exercise.exercise?.name?.trim() || "Bài tập"
  const variationName = exercise.variation?.name?.trim()

  if (variationName && normalizeText(variationName) !== "default") {
    return `${exerciseName} (${variationName})`
  }

  return exerciseName
}

export function snapshotWorkoutName(snapshot: Prisma.JsonValue | null | undefined, fallback?: string | null) {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && "name" in snapshot) {
    const name = snapshot.name
    if (typeof name === "string" && name.trim()) {
      return name.trim()
    }
  }

  return fallback?.trim() || "Workout"
}

export function completedSetCount(exercises: SnapshotExercise[]) {
  return exercises.reduce(
    (total, exercise) => total + (exercise.sets ?? []).filter((set) => set.completed !== false).length,
    0,
  )
}

export function totalSetCount(exercises: SnapshotExercise[]) {
  return exercises.reduce((total, exercise) => total + (exercise.sets?.length ?? 0), 0)
}
