"use client"

import { FileText, MoreVertical, RotateCcw, Trash2, TrendingDown, TrendingUp } from "lucide-react"
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
import { SetTempoBadge } from "@/components/workout/set-tempo-badge"
import type { ExerciseSet } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"
import { DEFAULT_BACKOFF_REDUCTION } from "@/lib/workout/set-targets"

/** What the coach programmed for a set, before this session changed anything. */
export type ProgramSetTarget = {
  reps: number
  repsMin?: number
  rir?: number
  suggestedRir?: number
  weight?: number
}

// Set | Prev | kg | Reps | RIR | menu. The trailing column keeps the row menu
// compact. Prev carries the longest string in the row
// ("82.5×8-10") while kg, Reps and RIR never hold more than a few digits, so on
// phones the width leans towards Prev — otherwise the target rep range is the
// part that gets truncated away.
export const SET_ROW_GRID_CLASS =
  "grid-cols-[22px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_28px] gap-1 px-2 sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] sm:gap-2 sm:px-4"

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

/** The progression engine's target for this set today. */
export type SetProgressionSuggestion = {
  direction: "down" | "hold" | "up"
  reps: number
  weight: number | null
}

interface SessionSetRowProps {
  programTarget?: ProgramSetTarget
  suggestion?: SetProgressionSuggestion
  backoffWeight?: number
  set: ExerciseSet
  setIndex: number
  weightUnit: "kg" | "lbs"
  canRemove: boolean
  /** The set the trainee is on — the one the bottom bar's button logs. */
  active?: boolean
  onChange: (patch: Partial<ExerciseSet>) => void
  onRemove: () => void
}

export function SessionSetRow({
  programTarget,
  suggestion,
  backoffWeight,
  set,
  setIndex,
  weightUnit,
  canRemove,
  active = false,
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
  const weightEditingRef = useRef(false)

  useEffect(() => {
    if (weightEditingRef.current) return
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

  // Prev column mixes two sources: weight from the trainee's last logged set of
  // this exercise in the same program, and reps from the coach's programmed rep
  // range for this program. Weight shows progression; the range shows today's
  // target. Added-in-session sets have no original program target row, so they
  // fall back to their own target range instead of showing an empty Prev cell.
  // In a program's first week the weight may instead be carried in from earlier
  // training, which is a starting point rather than a number to beat — it is
  // called out so the trainee does not read it as this program's progress.
  const suggestedRir = programTarget?.rir ?? programTarget?.suggestedRir
  const prevWeight = set.previousPerformance?.weight ?? programTarget?.weight
  const isSeededWeight = set.previousPerformance?.source === "other_program"
  const repsPart = programTarget
    ? formatRepTarget({ reps: programTarget.reps, repsMin: programTarget.repsMin })
    : set.previousPerformance?.reps != null
      ? String(set.previousPerformance.reps)
      : formatRepTarget({ reps: set.targetReps, repsMin: set.targetRepsMin })
  const weightPart = prevWeight != null ? String(prevWeight) : null
  // No spaces around the "×": at 375px the two of them are the difference
  // between showing the target rep range and truncating it away.
  const prevLabel =
    weightPart || repsPart ? `${weightPart ?? "—"}×${repsPart ?? "—"}` : "— · —"
  // The engine's target for today tints the Prev cell — up or down — and fills
  // the weight placeholder. It never writes a value: the trainee decides.
  const trend = suggestion && suggestion.direction !== "hold" ? suggestion.direction : null
  const suggestionLabel = suggestion
    ? `${suggestion.weight != null ? String(suggestion.weight) : "—"}×${suggestion.reps}`
    : null
  const TrendIcon = trend === "down" ? TrendingDown : TrendingUp
  // Today's target when the engine has one; otherwise, where a seeded weight came from.
  const prevCellHint = suggestionLabel
    ? messages.workoutPage.progressionSetHint(suggestionLabel)
    : isSeededWeight
      ? messages.workoutPage.seededWeightHint
      : undefined

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
        {/* Set number, with the method and cadence the coach prescribed for this set */}
        {set.intensityTag || set.tempo ? (
          <span
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center"
            title={set.intensityTag ? getIntensityTagLabel(set.intensityTag, messages) : undefined}
            aria-label={set.intensityTag
              ? messages.workoutPage.intensitySetMethodLabel(
                  setIndex + 1,
                  getIntensityTagLabel(set.intensityTag, messages),
                )
              : undefined}
          >
            <span
              className={cn(
                "font-mono text-base font-semibold leading-none",
                completed ? "text-primary" : active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {setIndex + 1}
            </span>
            {set.intensityTag ? <IntensityTagBadge tag={set.intensityTag} /> : null}
            <SetTempoBadge label={messages.workoutPage.tempoHint} tempo={set.tempo} />
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
            trend
              ? cn("inline-flex items-center justify-center gap-1", trend === "up" ? "text-success-text" : "text-warning-text")
              : "block truncate text-center text-muted-foreground",
          )}
          title={prevCellHint}
          aria-label={prevCellHint ? `${prevLabel}. ${prevCellHint}` : undefined}
        >
          {trend ? (
            <>
              <span className="truncate">{prevLabel}</span>
              <TrendIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            </>
          ) : (
            prevLabel
          )}
        </span>

        <input
          type="text"
          inputMode="decimal"
          value={weight}
          disabled={completed}
          onFocus={() => { weightEditingRef.current = true }}
          onBlur={() => {
            weightEditingRef.current = false
            const parsed = Number.parseFloat(weight.replace(",", "."))
            setWeight(Number.isFinite(parsed) ? String(parsed) : "")
          }}
          onChange={(e) => {
            const value = e.target.value.replace(",", ".")
            if (!/^\d*(?:\.\d*)?$/.test(value)) return
            setWeight(value)
            const parsed = Number.parseFloat(value)
            onChange({ weight: Number.isFinite(parsed) ? parsed : undefined })
          }}
          placeholder={String(backoffWeight ?? suggestion?.weight ?? "—")}
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
          placeholder={suggestedRir != null ? String(suggestedRir) : "—"}
          aria-label="RIR"
          min={0}
          max={10}
          className={cn(FIELD_CLASS, fieldStateClass(completed, active))}
        />

        <div className="flex items-center justify-end">
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
              {completed ? (
                <DropdownMenuItem onClick={() => onChange({ completed: false })}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {messages.workoutPage.markIncomplete}
                </DropdownMenuItem>
              ) : null}
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

      {!completed && backoffWeight != null && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 px-3 pb-1 text-xs sm:px-4">
          <span className="text-muted-foreground">
            {messages.workoutPage.backoffWeightHint(`${backoffWeight} ${weightUnit}`, DEFAULT_BACKOFF_REDUCTION, weightUnit === "kg")}
          </span>
          <button
            type="button"
            className="min-h-9 rounded-md px-2 font-medium text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            onClick={() => {
              setWeight(String(backoffWeight))
              onChange({ weight: backoffWeight })
            }}
          >
            {messages.workoutPage.useBackoffWeight}
          </button>
        </div>
      )}

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
