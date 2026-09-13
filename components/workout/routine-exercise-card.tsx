"use client"

import { ArrowLeftRight, ChevronDown, ChevronUp, Trash2 } from "lucide-react"

import { SetIntensityTagPicker } from "@/components/workout/set-intensity-tag"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import type { SetIntensityAssignment } from "@/lib/workout/intensity-tag"

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
  /** Locks every control, e.g. while the routine is saving. */
  disabled?: boolean
  /** Locks only the swap button, e.g. while the exercise library loads. */
  swapDisabled?: boolean
  /** The per-set method row only renders when the caller can store it. */
  setIntensityTags?: SetIntensityAssignment[]
  onSetIntensityTagsChange?: (assignments: SetIntensityAssignment[]) => void
}

const fieldInputClass = cn(
  "h-10 pointer-coarse:h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-center font-mono text-sm text-foreground tnum",
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring disabled:opacity-60",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
)

const iconButtonClass =
  "inline-flex h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"

function PrescriptionField({
  allowDecimals,
  allowRange,
  className,
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  allowDecimals?: boolean
  allowRange?: boolean
  className?: string
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
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
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

/**
 * One exercise inside a routine editor. Shared by the routine builder and the
 * schedule's quick routine dialog so both edit an exercise the same way.
 *
 * Layout, top to bottom: position + muscle meta with the reorder/remove
 * actions; the exercise name as its own full-width swap target; the load
 * prescription (sets · reps · kg on the first row, RIR · rest on the second on
 * narrow screens); then per-set methods and the note.
 */
export function RoutineExerciseCard({
  disabled,
  index,
  messages,
  meta,
  onFieldChange,
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

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-xs font-semibold text-primary-foreground tnum">
          {index + 1}
        </span>
        <p className="line-clamp-2 min-w-0 flex-1 break-words font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
          {meta}
        </p>
        <div className="-mr-1 flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            aria-label={messages.schedule.moveExerciseUp}
            className={iconButtonClass}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            aria-label={messages.schedule.moveExerciseDown}
            className={iconButtonClass}
          >
            <ChevronDown className="h-4 w-4" />
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

      <button
        type="button"
        onClick={onSwap}
        disabled={disabled || swapDisabled}
        title={t.swapExercise}
        aria-label={`${t.swapExercise}: ${title}`}
        className="group mt-2 flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug text-foreground">
          {title}
        </span>
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>

      {/* Six tracks on mobile so both rows fill the card: sets · reps · kg take
          two each, RIR · rest take three each. One row of five from sm up. */}
      <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-5">
        <PrescriptionField
          className="col-span-2 sm:col-span-1"
          label={t.set}
          value={values.sets}
          disabled={disabled}
          onChange={(value) => onFieldChange("sets", value)}
        />
        <PrescriptionField
          className="col-span-2 sm:col-span-1"
          label={t.reps}
          value={values.reps}
          placeholder="8-12"
          allowRange
          disabled={disabled}
          onChange={(value) => onFieldChange("reps", value)}
        />
        <PrescriptionField
          className="col-span-2 sm:col-span-1"
          label="kg"
          value={values.weight}
          allowDecimals
          disabled={disabled}
          onChange={(value) => onFieldChange("weight", value)}
        />
        <PrescriptionField
          className="col-span-3 sm:col-span-1"
          label="RIR"
          value={values.rir}
          placeholder="0-4"
          allowRange
          disabled={disabled}
          onChange={(value) => onFieldChange("rir", value)}
        />
        <PrescriptionField
          className="col-span-3 sm:col-span-1"
          label="REST"
          value={values.restTime}
          placeholder="90"
          disabled={disabled}
          onChange={(value) => onFieldChange("restTime", value)}
        />
      </div>

      {onSetIntensityTagsChange ? (
        <div className="mt-3 border-t border-border pt-1">
          <SetIntensityTagPicker
            messages={messages}
            setCount={Number(values.sets) || 0}
            value={setIntensityTags}
            onChange={onSetIntensityTagsChange}
          />
        </div>
      ) : null}

      <textarea
        value={values.notes}
        onChange={(event) => onFieldChange("notes", event.target.value)}
        placeholder={t.addNote}
        rows={1}
        disabled={disabled}
        className="mt-3 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
      />
    </div>
  )
}
