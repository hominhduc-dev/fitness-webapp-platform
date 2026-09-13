import type { AdminExerciseItem } from "@/lib/admin/types"
import { cn } from "@/lib/utils"

type MuscleProfileSummaryProps = {
  className?: string
  exercise: Pick<AdminExerciseItem, "muscleProfileRationale" | "muscleProfileSource" | "primaryMuscles" | "secondaryMuscles">
  locale: "en" | "vi"
}

function formatMuscleSlug(slug: string) {
  return slug.replace(/-/g, " ")
}

/**
 * One line per variation with the muscle targets an admin is approving, so a
 * list of AI suggestions can be reviewed without opening every exercise. The
 * AI's rationale is the tooltip.
 */
export function MuscleProfileSummary({ className, exercise, locale }: MuscleProfileSummaryProps) {
  const primary = exercise.primaryMuscles ?? []
  const secondary = exercise.secondaryMuscles ?? []
  if (primary.length === 0 && secondary.length === 0) return null

  const en = locale === "en"
  const source = exercise.muscleProfileSource === "ai"
    ? "AI"
    : exercise.muscleProfileSource === "manual"
      ? (en ? "Manual" : "Thủ công")
      : undefined

  return (
    <p
      className={cn("truncate text-micro text-muted-foreground", className)}
      title={exercise.muscleProfileRationale ?? undefined}
    >
      {source ? <span className="font-medium text-foreground">{source} · </span> : null}
      {primary.length > 0 ? (
        <span>{en ? "Primary" : "Chính"}: {primary.map(formatMuscleSlug).join(", ")}</span>
      ) : null}
      {secondary.length > 0 ? (
        <span>{primary.length > 0 ? " · " : ""}{en ? "Secondary" : "Phụ"}: {secondary.map(formatMuscleSlug).join(", ")}</span>
      ) : null}
    </p>
  )
}

/** Whether bulk approval would accept this profile: strength needs a primary muscle. */
export function canApproveMuscleProfile(exercise: Pick<AdminExerciseItem, "activityType" | "primaryMuscles">) {
  return Boolean(exercise.activityType) && (exercise.activityType !== "strength" || (exercise.primaryMuscles?.length ?? 0) > 0)
}
