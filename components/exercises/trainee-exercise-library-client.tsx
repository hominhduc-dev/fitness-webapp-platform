"use client"

import { useMemo } from "react"
import { Loader2 } from "lucide-react"

import { ExerciseLibraryPanel } from "@/components/admin/admin-exercises-panel"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { AdminExerciseItem } from "@/lib/admin/types"
import { useExercises } from "@/lib/queries/exercises"

const ignoreAction = () => undefined
const ignoreMutation = async () => undefined

export function TraineeExerciseLibraryClient() {
  const { locale } = useLocale()
  const query = useExercises()
  const exercises = useMemo(
    () => (query.data ?? []).map((exercise): AdminExerciseItem & { canManage: false } => ({
      activityType: exercise.activityType,
      canManage: false,
      // The public catalogue omits management metadata; read-only rows never display it.
      createdAt: new Date(0),
      createdBy: null,
      equipment: exercise.equipment,
      id: exercise.id,
      isDefault: exercise.isDefault,
      media: exercise.media,
      movementPattern: exercise.movementPattern,
      muscleGroup: exercise.muscleGroup,
      name: exercise.exerciseName,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      updatedAt: new Date(0),
      usageCount: 0,
      variationName: exercise.variationName,
    })),
    [query.data],
  )

  if (query.isPending) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {locale === "en" ? "Loading exercise library…" : "Đang tải thư viện bài tập…"}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 text-center">
        <p className="text-sm text-destructive-text">
          {locale === "en" ? "Unable to load the exercise library." : "Không thể tải thư viện bài tập."}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {locale === "en" ? "Try again" : "Thử lại"}
        </Button>
      </div>
    )
  }

  return (
    <ExerciseLibraryPanel
      readOnly
      actionKey={null}
      exercises={exercises}
      locale={locale}
      onSave={ignoreMutation}
      onDelete={ignoreMutation}
      onBulkDelete={ignoreMutation}
      onImport={ignoreAction}
      onDownloadTemplate={ignoreAction}
    />
  )
}
