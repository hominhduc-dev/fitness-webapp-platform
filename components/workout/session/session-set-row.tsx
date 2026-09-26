"use client"

import { Check, FileText, MoreVertical, Trash2, TrendingUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IntensityTagBadge, getIntensityTagLabel } from "@/components/workout/set-intensity-tag"
import type { ExerciseSet } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"

/** What the coach programmed for a set, before this session changed anything. */
export type ProgramSetTarget = {
  reps: number
  repsMin?: number
  rir?: number
  weight?: number
}

// Set | Prev | kg | Reps | RIR | tick + menu. The trailing column holds a 44px
// tick and the row menu. Prev carries the longest string in the row
// ("82.5×8-10") while kg, Reps and RIR never hold more than a few digits, so on
// phones the width leans towards Prev — otherwise the target rep range is the
// part that gets truncated away.
export const SET_ROW_GRID_CLASS =
  "grid-cols-[22px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_68px] gap-1 px-2 sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_76px] sm:gap-2 sm:px-4"

// Every figure is plain text, never a box or a line. The touch target stays
// full height; only the field being typed in shows an accent underline. `!` on
// the background because globals.css gives every input an unlayered scrim,
// which beats utilities.
const FIELD_CLASS = cn(
  "mx-auto block h-9 w-full max-w-12 min-w-0 rounded-none border-0 bg-transparent! px-0 text-center font-mono text-[15px] tabular-nums",
  "pointer-coarse:h-11 transition-[color,box-shadow] duration-[180ms]",
  "focus:text-foreground focus:outline-none focus:shadow-[inset_0_-2px_0_var(--primary)]",
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  "disabled:cursor-default",
)

// Logged sets read as the log will; the set being done is set in bold; other
// sets to do are dimmed but still editable.
function fieldStateClass(completed: boolean, active: boolean) {
  if (completed) return "text-foreground"
  if (active) return "font-semibold text-foreground"
  return "text-muted-foreground"
}

interface SessionSetRowProps {
  programTarget?: ProgramSetTarget
  set: ExerciseSet
  setIndex: number
  weightUnit: "kg" | "lbs"
  canRemove: boolean
  /** The set the trainee is on — the one the bottom bar's button logs. */
  active?: boolean
  onToggle: (data: Partial<ExerciseSet>) => void
  onChange: (patch: Partial<ExerciseSet>) => void
  onRemove: () => void
}

export function SessionSetRow({
  programTarget,
  set,
  setIndex,
  weightUnit,
  canRemove,
  active = false,
  onToggle,
  onChange,
  onRemove,
}: SessionSetRowProps) {
  const { messages } = useLocale()
  const [weight, setWeight] = useState(set.weight?.toString() ?? "")
  const [reps, setReps] = useState((set.actualReps ?? set.targetReps).toString())
  const [rir, setRir] = useState(set.rir?.toString() ?? "")
  // Read from the set rather than kept here: the bottom bar can log this set too.
  const completed = set.completed
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(set.notes ?? "")
  const previousSetIdRef = useRef(set.id)

  useEffect(() => {
    setWeight(set.weight?.toString() ?? "")
  }, [set.id, set.weight])

  useEffect(() => {
    if (previousSetIdRef.current !== set.id) {
      previousSetIdRef.current = set.id
      setReps((set.actualReps ?? set.targetReps).toString())
      return
    }

    if (set.actualReps != null) {
      setReps(set.actualReps.toString())
    }
  }, [set.actualReps, set.id, set.targetReps])

  useEffect(() => {
    setRir(set.rir?.toString() ?? "")
  }, [set.id, set.rir])

  const handleToggle = () => {
    const next = !completed
    onToggle({
      completed: next,
      weight: Number.parseFloat(weight) || undefined,
      actualReps: Number.parseInt(reps) || set.targetReps,
      rir: rir.trim() ? Number.parseInt(rir) : undefined,
    })
  }

  // Prev column mixes two sources: weight from the trainee's last logged set of
  // this exercise in the same program, and reps from the coach's programmed rep
  // range for this program. Weight shows progression; the range shows today's
  // target. Each side falls back to the other source when one is missing.
  const prevWeight = set.previousPerformance?.weight ?? programTarget?.weight
  const repsPart = programTarget
    ? formatRepTarget({ reps: programTarget.reps, repsMin: programTarget.repsMin })
    : set.previousPerformance?.reps != null
      ? String(set.previousPerformance.reps)
      : null
  const weightPart = prevWeight != null ? String(prevWeight) : null
  // No spaces around the "×": at 375px the two of them are the difference
  // between showing the target rep range and truncating it away.
  const prevLabel =
    weightPart || repsPart ? `${weightPart ?? "—"}×${repsPart ?? "—"}` : "— · —"
  // Passive progression hint: if last session's reps exceeded the coach's upper
  // bound, tint the cell green and append a ↗ so trainee sees they've earned a
  // weight bump. No auto-adjustment — trainee decides.
  const exceededRange =
    set.previousPerformance?.reps != null &&
    programTarget?.reps != null &&
    set.previousPerformance.reps > programTarget.reps

  return (
    <div
      data-tour="session-set"
      aria-current={active ? "step" : undefined}
      className={cn(
        "transition-colors duration-[180ms]",
        // Done sets carry the highlight: progress is what the table shows off.
        completed && "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
      )}
    >
      <div className={cn("grid min-w-0 items-center py-1", SET_ROW_GRID_CLASS)}>
        {/* Set number, with the method the coach prescribed for this set */}
        {set.intensityTag ? (
          <span
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center"
            title={getIntensityTagLabel(set.intensityTag, messages)}
            aria-label={messages.workoutPage.intensitySetMethodLabel(
              setIndex + 1,
              getIntensityTagLabel(set.intensityTag, messages),
            )}
          >
            <span
              className={cn(
                "font-mono text-base font-semibold leading-none",
                completed ? "text-primary" : active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {setIndex + 1}
            </span>
            <IntensityTagBadge tag={set.intensityTag} />
          </span>
        ) : (
          <span
            className={cn(
              "min-w-0 text-center font-mono text-base font-semibold",
              completed ? "text-primary" : active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {setIndex + 1}
          </span>
        )}

        {/* Previous */}
        <span
          className={cn(
            "min-w-0 font-mono text-micro leading-tight",
            exceededRange
              ? "inline-flex items-center justify-center gap-1 text-success-text"
              : "block truncate text-center text-muted-foreground",
          )}
          title={exceededRange ? messages.workoutPage.prevExceededHint : undefined}
          aria-label={exceededRange ? `${prevLabel}. ${messages.workoutPage.prevExceededHint}` : undefined}
        >
          {exceededRange ? (
            <>
              <span className="truncate">{prevLabel}</span>
              <TrendingUp className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            </>
          ) : (
            prevLabel
          )}
        </span>

        <input
          type="number"
          inputMode="decimal"
          value={weight}
          disabled={completed}
          onChange={(e) => {
            setWeight(e.target.value)
            onChange({ weight: Number.parseFloat(e.target.value) || undefined })
          }}
          placeholder="—"
          aria-label={messages.workoutPage.weightInUnit(weightUnit)}
          className={cn(FIELD_CLASS, fieldStateClass(completed, active))}
        />

        <input
          type="number"
          inputMode="numeric"
          value={reps}
          disabled={completed}
          onChange={(e) => {
            setReps(e.target.value)
            onChange({ actualReps: Number.parseInt(e.target.value) || undefined })
          }}
          placeholder="—"
          aria-label={messages.workoutPage.reps}
          className={cn(FIELD_CLASS, fieldStateClass(completed, active))}
        />

        <input
          type="number"
          inputMode="numeric"
          value={rir}
          disabled={completed}
          onChange={(e) => {
            setRir(e.target.value)
            onChange({ rir: e.target.value.trim() ? Number.parseInt(e.target.value) : undefined })
          }}
          placeholder={set.rir != null ? String(set.rir) : "—"}
          aria-label="RIR"
          min={0}
          max={10}
          className={cn(FIELD_CLASS, fieldStateClass(completed, active))}
        />

        {/* Row actions: the tick is the most-tapped control in the app, so the
            button is a full 44px target on touch while the circle drawn inside
            stays small; the menu stays narrow beside it. */}
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={handleToggle}
            aria-label={completed ? messages.workoutPage.markIncomplete : messages.workoutPage.completeSet}
            aria-pressed={completed}
            className="group flex size-10 shrink-0 items-center justify-center rounded-full outline-none pointer-coarse:size-11"
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(.2,.7,.2,1)]",
                "group-focus-visible:ring-2 group-focus-visible:ring-ring group-active:scale-90",
                completed
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "border-[1.5px] border-primary text-primary"
                    : "border border-border text-transparent group-hover:border-primary/60",
              )}
            >
              <Check className="size-4" strokeWidth={3} />
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={messages.workoutPage.setOptions}
                className="relative flex h-10 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground pointer-coarse:h-11"
              >
                <MoreVertical className="h-4 w-4" />
                {note.trim() ? (
                  <span aria-hidden className="absolute right-0 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setNoteOpen((v) => !v)}>
                <FileText className="mr-2 h-4 w-4" />
                {noteOpen ? messages.workoutPage.hideNote : messages.workoutPage.addNote}
              </DropdownMenuItem>
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive-text focus:text-destructive-text"
                    onClick={onRemove}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {messages.workoutPage.removeSet}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Set note (inline, collapsible) */}
      {noteOpen && (
        <div className="px-3 pb-2 sm:px-4">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              onChange({ notes: e.target.value || undefined })
            }}
            placeholder={messages.workoutPage.noteForSet}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
    </div>
  )
}
