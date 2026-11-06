"use client"

import { ArrowDownUp, Check, ChevronRight, EllipsisVertical, HeartPulse, Loader2, Pencil, PersonStanding, Share2, Trash2, Undo2 } from "lucide-react"

import { canApproveMuscleProfile } from "@/components/admin/muscle-profile-summary"
import { MuscleMap, preferredBodySide, type MuscleSlug as MapMuscleSlug } from "@/components/body/muscle-map"
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { AdminExerciseItem } from "@/lib/admin/types"
import { capitalizeExerciseName } from "@/lib/exercise-display"
import type { LibraryGroup, LibraryGroupKey } from "@/lib/fitness/exercise-library-groups"
import { movementPatternLabel } from "@/lib/fitness/movement-pattern"
import type { ExerciseActivityType } from "@/lib/types"
import { cn } from "@/lib/utils"
import styles from "./exercise-group-grid.module.css"

type Locale = "en" | "vi"

const ACTIVITY_LABELS: Record<ExerciseActivityType, { en: string; vi: string }> = {
  cardio: { en: "Cardio", vi: "Cardio" },
  mobility: { en: "Mobility", vi: "Linh hoạt" },
  other: { en: "Other", vi: "Khác" },
  sport: { en: "Sport", vi: "Thể thao" },
  strength: { en: "Strength", vi: "Sức mạnh" },
}

function getBrowserCopy(locale: Locale) {
  return {
    actions: locale === "en" ? "Actions" : "Thao tác",
    approveProfile: locale === "en" ? "Approve muscle profile" : "Duyệt profile cơ",
    cannotApproveProfile: locale === "en" ? "Add a primary muscle before approving" : "Cần có cơ chính trước khi duyệt",
    cannotDeleteInUse: locale === "en" ? "Cannot delete - in use" : "Không thể xóa - đang được dùng",
    cannotManageShared: locale === "en" ? "Cannot manage shared exercise" : "Không thể sửa bài tập dùng chung",
    delete: locale === "en" ? "Delete" : "Xóa",
    edit: locale === "en" ? "Edit" : "Sửa",
    exerciseCount: (count: number) => (locale === "en" ? `${count.toLocaleString()} exercise${count === 1 ? "" : "s"}` : `${count.toLocaleString()} bài tập`),
    muscleReview: locale === "en" ? "Muscles need review" : "Cơ chờ duyệt",
    requestShare: locale === "en" ? "Suggest for shared library" : "Đề xuất dùng chung",
    shareStatus: {
      pending: locale === "en" ? "Awaiting review" : "Chờ duyệt",
      rejected: locale === "en" ? "Not shared" : "Chưa được duyệt",
      shared: locale === "en" ? "Shared" : "Dùng chung",
    },
    transferMetadata: locale === "en" ? "Transfer metadata" : "Chuyển metadata",
    undoTransfer: locale === "en" ? "Undo metadata transfer" : "Hoàn tác chuyển metadata",
  }
}

function canManageExercise(exercise: AdminExerciseItem) {
  return (exercise as AdminExerciseItem & { canManage?: boolean }).canManage ?? true
}

/** "Strength • Horizontal push", falling back to the type alone until the exercise is classified. */
function exerciseSubtitle(exercise: AdminExerciseItem, locale: Locale) {
  const activity = exercise.activityType ? ACTIVITY_LABELS[exercise.activityType][locale] : null
  const pattern = exercise.movementPattern ? movementPatternLabel(exercise.movementPattern, locale) : null
  return [activity, pattern].filter(Boolean).join(" • ")
}

function exerciseTitle(exercise: AdminExerciseItem) {
  const name = capitalizeExerciseName(exercise.name)
  return exercise.variationName && exercise.variationName !== "Default"
    ? `${name} · ${capitalizeExerciseName(exercise.variationName)}`
    : name
}

/* ------------------------------------------------------------------ */
/* Group grid                                                           */
/* ------------------------------------------------------------------ */

function GroupFigure({ group }: { group: LibraryGroup }) {
  if (group.slugs.length === 0) {
    const Icon = group.key === "cardio" ? HeartPulse : PersonStanding
    return (
      <span className="grid place-items-center text-primary">
        <Icon className="size-8" />
      </span>
    )
  }

  const highlights = Object.fromEntries(group.slugs.map((slug) => [slug, "var(--exercise-group-highlight)"])) as Partial<Record<MapMuscleSlug, string>>
  return (
    <MuscleMap
      side={preferredBodySide(group.slugs)}
      highlights={highlights}
      defaultFill="var(--exercise-group-silhouette)"
      outline={null}
      className="h-20 w-12"
    />
  )
}

export function ExerciseGroupGrid({
  groups,
  locale,
  onOpen,
}: {
  groups: Array<{ group: LibraryGroup; items: AdminExerciseItem[] }>
  locale: Locale
  onOpen: (key: LibraryGroupKey) => void
}) {
  const copy = getBrowserCopy(locale)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {groups.map(({ group, items }) => (
        <button
          key={group.key}
          type="button"
          onClick={() => onOpen(group.key)}
          className={cn(styles.card, "group min-w-0 cursor-pointer rounded-2xl text-start motion-safe:transition-colors")}
        >
          <span className={cn(styles.figure, "grid place-items-center rounded-xl")} aria-hidden="true">
            <GroupFigure group={group} />
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold leading-snug lg:text-base">{group.label[locale]}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{copy.exerciseCount(items.length)}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary group-focus-visible:text-primary" aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise rows                                                        */
/* ------------------------------------------------------------------ */

export type ExerciseRowActionHandlers = {
  onEdit: (exercise: AdminExerciseItem) => void
  onDelete: (exercise: AdminExerciseItem) => void
  onApproveProfile?: (exercise: AdminExerciseItem) => void
  onTransferMetadata?: (exercise: AdminExerciseItem) => void
  onUndoMetadataTransfer?: (exercise: AdminExerciseItem) => void
  onRequestShare?: (exercise: AdminExerciseItem) => void
  approvingProfiles: boolean
  deletingId: string | null
  transferringId: string | null
}

function ExerciseRowActions({ exercise, locale, handlers }: { exercise: AdminExerciseItem; locale: Locale; handlers: ExerciseRowActionHandlers }) {
  const copy = getBrowserCopy(locale)
  const canManage = canManageExercise(exercise)
  const busy = handlers.transferringId === exercise.id || handlers.deletingId === exercise.id
  const canShare = handlers.onRequestShare && canManage && (exercise.shareStatus === "private" || exercise.shareStatus === "rejected")
  const canApprove = handlers.onApproveProfile && canManage && exercise.muscleProfileStatus === "pending"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label={`${copy.actions}: ${exerciseTitle(exercise)}`}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <EllipsisVertical className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={!canManage} onSelect={() => handlers.onEdit(exercise)}><Pencil />{copy.edit}</DropdownMenuItem>
        {canApprove ? (
          <DropdownMenuItem
            disabled={handlers.approvingProfiles || !canApproveMuscleProfile(exercise)}
            title={canApproveMuscleProfile(exercise) ? undefined : copy.cannotApproveProfile}
            onSelect={() => handlers.onApproveProfile?.(exercise)}
          >
            <Check />{copy.approveProfile}
          </DropdownMenuItem>
        ) : null}
        {handlers.onTransferMetadata ? (
          <DropdownMenuItem disabled={!canManage || busy} onSelect={() => handlers.onTransferMetadata?.(exercise)}><ArrowDownUp />{copy.transferMetadata}</DropdownMenuItem>
        ) : null}
        {handlers.onUndoMetadataTransfer && exercise.undoableMetadataTransferId ? (
          <DropdownMenuItem disabled={!canManage || busy} onSelect={() => handlers.onUndoMetadataTransfer?.(exercise)}><Undo2 />{copy.undoTransfer}</DropdownMenuItem>
        ) : null}
        {canShare ? <DropdownMenuItem onSelect={() => handlers.onRequestShare?.(exercise)}><Share2 />{copy.requestShare}</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canManage || exercise.usageCount > 0 || busy}
          title={!canManage ? copy.cannotManageShared : exercise.usageCount > 0 ? copy.cannotDeleteInUse : undefined}
          onSelect={() => handlers.onDelete(exercise)}
        >
          <Trash2 />{copy.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ExerciseRowGrid({
  exercises,
  handlers,
  locale,
  selected,
  onToggleSelect,
}: {
  exercises: AdminExerciseItem[]
  handlers: ExerciseRowActionHandlers
  locale: Locale
  /** Without it the rows have no checkboxes. */
  selected?: ReadonlySet<string>
  onToggleSelect?: (id: string) => void
}) {
  const copy = getBrowserCopy(locale)

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {exercises.map((exercise) => {
        const canManage = canManageExercise(exercise)
        const isSelected = selected?.has(exercise.id) ?? false
        const subtitle = exerciseSubtitle(exercise, locale)
        // Admins' own exercises are library data from the start; only a coach's carry a review status.
        const shareStatus = exercise.shareStatus && exercise.shareStatus !== "private" && exercise.createdBy?.role !== "admin" ? exercise.shareStatus : null

        return (
          <div
            key={exercise.id}
            style={{ contentVisibility: "auto", containIntrinsicSize: "84px" }}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-2 transition-colors",
              isSelected ? "border-primary/50 bg-primary/5" : canManage && "hover:border-foreground/30 hover:bg-surface-hover",
            )}
          >
            {selected && onToggleSelect ? (
              canManage ? (
                <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(exercise.id)} aria-label={exerciseTitle(exercise)} />
              ) : (
                <span className="size-4 shrink-0" />
              )
            ) : null}
            <ExerciseThumbnail media={exercise.media} name={exerciseTitle(exercise)} previewable size="lg" />
            <button
              type="button"
              disabled={!canManage}
              onClick={() => handlers.onEdit(exercise)}
              className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left disabled:cursor-default"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{exerciseTitle(exercise)}</span>
                {subtitle ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
                {shareStatus || exercise.muscleProfileStatus === "pending" ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {shareStatus ? (
                      <Badge
                        variant="outline"
                        title={exercise.shareStatus === "rejected" ? exercise.shareReviewNote : undefined}
                        className={cn("text-micro", shareStatus === "shared" && "border-primary/30 text-primary")}
                      >
                        {copy.shareStatus[shareStatus]}
                      </Badge>
                    ) : null}
                    {exercise.muscleProfileStatus === "pending" ? (
                      <Badge variant="outline" className="border-warning/40 text-micro text-warning-text">{copy.muscleReview}</Badge>
                    ) : null}
                  </span>
                ) : null}
              </span>
              {canManage ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            </button>
            <ExerciseRowActions exercise={exercise} locale={locale} handlers={handlers} />
          </div>
        )
      })}
    </div>
  )
}
