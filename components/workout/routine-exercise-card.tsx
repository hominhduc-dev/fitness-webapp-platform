"use client"

import { useId, useState } from "react"
import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, NotebookPen, Pencil, Trash2 } from "lucide-react"

import { IntensityTagBadge, SetIntensityTagPicker } from "@/components/workout/set-intensity-tag"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import { normalizeSetIntensityAssignments, type SetIntensityAssignment } from "@/lib/workout/intensity-tag"

export type RoutineExerciseField = "sets" | "reps" | "weight" | "rir" | "restTime" | "notes"

export type RoutineExerciseCardProps = {
  /** Zero-based position in the routine. */
  index: number
  total: number
  title: string
  meta?: string
  values: Record<RoutineExerciseField, string>
  messages: AppMessages
  onFieldChange: (field: RoutineExerciseField, value: string) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onSwap: () => void
  /** Whether the card starts open. Read on mount only; the card owns it after. */
  defaultExpanded?: boolean
  /** Controlled expanded state for flows that coordinate multiple cards. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Locks every editing control, e.g. while the routine is saving. */
  disabled?: boolean
  /** Locks only the swap button, e.g. while the exercise library loads. */
  swapDisabled?: boolean
  /** The per-set method row only renders when the caller can store it. */
  setIntensityTags?: SetIntensityAssignment[]
  onSetIntensityTagsChange?: (assignments: SetIntensityAssignment[]) => void
}

const fieldInputClass = cn(
  "h-9 pointer-coarse:h-10 w-full min-w-0 rounded-md border border-input bg-background px-1 text-center font-mono text-sm text-foreground tnum",
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring disabled:opacity-60",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
)

const iconButtonClass =
  "inline-flex h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"

function PrescriptionField({
  allowDecimals,
  allowRange,
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  allowDecimals?: boolean
  allowRange?: boolean
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  // Range fields (reps / RIR) accept "8-12"; mobile numeric keypads have no "-"
  // key, so those fall back to the text keyboard.
  const inputMode = allowRange ? "text" : allowDecimals ? "decimal" : "numeric"

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-center font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <input
        type={allowDecimals ? "number" : "text"}
        inputMode={inputMode}
        min="0"
        step={allowDecimals ? "0.5" : "1"}
        value={value}
        placeholder={placeholder ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={fieldInputClass}
      />
    </label>
  )
}

/** "3 × 8-12 · 20 kg · RIR 2 · 90s": what the collapsed row shows in place of the fields. */
export function formatPrescriptionSummary(values: Record<RoutineExerciseField, string>) {
  const parts = [`${values.sets || "0"} × ${values.reps || "—"}`]
  if (values.weight) parts.push(`${values.weight} kg`)
  if (values.rir) parts.push(`RIR ${values.rir}`)
  if (values.restTime) parts.push(`${values.restTime}s`)
  return parts.join(" · ")
}

/**
 * One exercise inside a routine editor, shared by the routine builder (trainee
 * and coach) and the schedule's quick routine dialog.
 *
 * Collapsed, it is a single row: position, name, and a one-line prescription
 * summary with any per-set method badges. Expanded, the same row stays as the
 * header and the editor opens below it: the five prescription fields on one
 * row, per-set methods, the note, and a toolbar for swap, reorder and remove.
 */
export function RoutineExerciseCard({
  defaultExpanded = true,
  disabled,
  expanded: controlledExpanded,
  index,
  messages,
  meta,
  onFieldChange,
  onExpandedChange,
  onMove,
  onRemove,
  onSetIntensityTagsChange,
  onSwap,
  setIntensityTags,
  swapDisabled,
  title,
  total,
  values,
}: RoutineExerciseCardProps) {
  const t = messages.workoutPage
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
  const expanded = controlledExpanded ?? uncontrolledExpanded
  const bodyId = useId()
  const setCount = Number(values.sets) || 0
  const methodBadges = onSetIntensityTagsChange
    ? [...new Set(normalizeSetIntensityAssignments(setIntensityTags, setCount).map(({ tag }) => tag))]
    : []

  const setExpanded = (next: boolean | ((current: boolean) => boolean)) => {
    const nextValue = typeof next === "function" ? next(expanded) : next
    if (controlledExpanded === undefined) {
      setUncontrolledExpanded(nextValue)
    }
    onExpandedChange?.(nextValue)
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-subtle transition-colors",
        expanded ? "border-primary/30" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={`${expanded ? t.collapseExercise : t.expandExercise}: ${title}`}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-xs font-semibold text-primary-foreground tnum">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground tnum">
              {expanded ? meta : formatPrescriptionSummary(values)}
            </span>
            {!expanded && methodBadges.map((tag) => <IntensityTagBadge key={tag} tag={tag} className="shrink-0" />)}
            {!expanded && values.notes.trim() ? (
              <NotebookPen aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : null}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div id={bodyId} className="border-t border-border px-2.5 pb-2 pt-2.5">
          <div className="grid grid-cols-5 gap-1.5">
            <PrescriptionField
              label={t.set}
              value={values.sets}
              disabled={disabled}
              onChange={(value) => onFieldChange("sets", value)}
            />
            <PrescriptionField
              label={t.reps}
              value={values.reps}
              placeholder="8-12"
              allowRange
              disabled={disabled}
              onChange={(value) => onFieldChange("reps", value)}
            />
            <PrescriptionField
              label="kg"
              value={values.weight}
              allowDecimals
              disabled={disabled}
              onChange={(value) => onFieldChange("weight", value)}
            />
            <PrescriptionField
              label="RIR"
              value={values.rir}
              placeholder="0-4"
              allowRange
              disabled={disabled}
              onChange={(value) => onFieldChange("rir", value)}
            />
            <PrescriptionField
              label="REST"
              value={values.restTime}
              placeholder="90"
              disabled={disabled}
              onChange={(value) => onFieldChange("restTime", value)}
            />
          </div>

          {/* Methods and the note share a row. Round set chips keep five sets
              beside the note on a phone; past that the note wraps below. */}
          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            {onSetIntensityTagsChange ? (
              <SetIntensityTagPicker
                messages={messages}
                setCount={setCount}
                value={setIntensityTags}
                onChange={onSetIntensityTagsChange}
              />
            ) : null}

            <div className="relative min-w-[6.5rem] flex-1">
              <Pencil
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={values.notes}
                onChange={(event) => onFieldChange("notes", event.target.value)}
                placeholder={t.addNote}
                aria-label={t.addNote}
                disabled={disabled}
                className="block h-9 w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm leading-5 text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onSwap}
              disabled={disabled || swapDisabled}
              aria-label={`${t.swapExercise}: ${title}`}
              className="-ml-1 inline-flex h-8 pointer-coarse:h-10 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {t.swapExercise}
            </button>
            <div className="-mr-1 flex items-center">
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={disabled || index === 0}
                aria-label={messages.schedule.moveExerciseUp}
                className={iconButtonClass}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={disabled || index === total - 1}
                aria-label={messages.schedule.moveExerciseDown}
                className={iconButtonClass}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={t.removeExercise}
                className={cn(iconButtonClass, "hover:bg-destructive-soft hover:text-destructive-text")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
