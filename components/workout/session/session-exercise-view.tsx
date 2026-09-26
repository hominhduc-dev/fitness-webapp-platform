"use client"

import {
  ArrowDownNarrowWide,
  ChevronDown,
  ChevronUp,
  Edit3,
  Play,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"

import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { useLocale } from "@/components/providers/locale-provider"
import { ExerciseAnimation } from "@/components/workout/exercise-animation"
import {
  SET_ROW_GRID_CLASS,
  SessionSetRow,
  type ProgramSetTarget,
} from "@/components/workout/session/session-set-row"
import type { CoachHint } from "@/lib/fitness/coach-hints"
import type { CoachUpdate, ExerciseSet, WorkoutExercise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"
import { activeSetIndex } from "@/lib/workout/session-navigation"

function getCoachUpdateMeta(type: CoachUpdate["type"]) {
  switch (type) {
    case "weight_up":
      return {
        icon: TrendingUp,
        panelClassName:
          "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]",
        textClassName: "text-success-text",
      }
    case "rir_down":
    case "weight_down":
      return {
        icon: ArrowDownNarrowWide,
        panelClassName:
          "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)]",
        textClassName: "text-warning-text",
      }
    case "rir_up":
    case "edit":
    default:
      return {
        icon: Edit3,
        panelClassName:
          "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
        textClassName: "text-primary",
      }
  }
}

/** "2 sets · 8–12 reps · RIR 2", from what the coach programmed for set one. */
function useTargetSummary(exercise: WorkoutExercise, programSetTargets: Map<string, ProgramSetTarget>) {
  const { messages } = useLocale()
  const firstSet = exercise.sets[0]
  const target = firstSet ? programSetTargets.get(firstSet.id) : undefined
  const parts = [messages.workoutPage.setCount(exercise.sets.length)]
  if (firstSet) {
    const reps = formatRepTarget(
      target ? { reps: target.reps, repsMin: target.repsMin } : { reps: firstSet.targetReps, repsMin: firstSet.targetRepsMin },
    )
    // An en dash reads as a range; the stored form keeps a hyphen.
    parts.push(messages.workoutPage.exerciseTargetReps(reps.replace("-", "–")))
  }
  if (target?.rir != null) parts.push(`RIR ${target.rir}`)
  return parts.join(" · ")
}

interface SessionExerciseViewProps {
  exercise: WorkoutExercise
  exerciseLabel: string
  coachHint: CoachHint | null
  coachHintText: string | null
  onApplyCoachHint: (hint: CoachHint, exerciseId: string) => void
  programSetTargets: Map<string, ProgramSetTarget>
  weightUnit: "kg" | "lbs"
  noteOpen: boolean
  onSetUpdate: (setId: string, patch: Partial<ExerciseSet>) => void
  onSetComplete: (exercise: WorkoutExercise, set: ExerciseSet, data: Partial<ExerciseSet>) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
  onExerciseNoteChange: (exerciseId: string, note: string) => void
}

/**
 * The one exercise on screen during a session. Mount it keyed by the exercise
 * id: the animation panel and the local note draft start fresh on every
 * exercise.
 */
export function SessionExerciseView({
  exercise,
  exerciseLabel,
  coachHint,
  coachHintText,
  onApplyCoachHint,
  programSetTargets,
  weightUnit,
  noteOpen,
  onSetUpdate,
  onSetComplete,
  onAddSet,
  onRemoveSet,
  onExerciseNoteChange,
}: SessionExerciseViewProps) {
  const { messages } = useLocale()
  // Closed by default so the sets sit right under the header; the animation
  // (a GIF or MP4) only downloads once the trainee asks for it.
  const [animationOpen, setAnimationOpen] = useState(false)
  const [coachUpdateOpen, setCoachUpdateOpen] = useState(false)
  const [note, setNote] = useState(exercise.notes ?? "")
  const media = exercise.variation.media
  const coachUpdate = exercise.coachUpdate
  const coachUpdateMeta = coachUpdate ? getCoachUpdateMeta(coachUpdate.type) : null
  const CoachUpdateIcon = coachUpdateMeta?.icon
  const targetSummary = useTargetSummary(exercise, programSetTargets)
  const activeSet = activeSetIndex(exercise)

  return (
    <div className="min-w-0">
      {/* Header: thumbnail (toggles the animation), name and target, search. */}
      <div data-tour="session-exercise" className="mb-4 flex items-start gap-3.5">
        {media ? (
          <button
            type="button"
            onClick={() => setAnimationOpen((value) => !value)}
            aria-expanded={animationOpen}
            aria-label={animationOpen ? messages.workoutPage.hideExerciseAnimation : messages.workoutPage.showExerciseAnimation}
            className="group relative shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExerciseThumbnail media={media} name={exerciseLabel} size="lg" />
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform group-active:scale-95"
            >
              {animationOpen ? (
                <ChevronUp className="size-3.5" strokeWidth={2.5} />
              ) : (
                <Play className="size-3 translate-x-px fill-current" />
              )}
            </span>
          </button>
        ) : (
          <span title={messages.workoutPage.noExerciseMedia} className="shrink-0">
            <ExerciseThumbnail name={exerciseLabel} size="lg" />
          </span>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="m-0 line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.01em] text-foreground md:text-2xl">
            {exerciseLabel}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-muted-foreground">{targetSummary}</p>
            {coachUpdate && coachUpdateMeta && CoachUpdateIcon ? (
              <button
                type="button"
                onClick={() => setCoachUpdateOpen((value) => !value)}
                aria-label="Coach update"
                aria-expanded={coachUpdateOpen}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded border-0 bg-muted/60 px-[7px] py-[3px]",
                  "font-mono text-micro font-semibold uppercase tracking-[0.07em]",
                  coachUpdateMeta.textClassName,
                )}
              >
                <CoachUpdateIcon className="h-[11px] w-[11px]" />
                <span>Coach</span>
                {coachUpdateOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
            ) : null}
          </div>
        </div>

        {/* Pinned to the first line of the name: a two-line name never pushes it down. */}
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`${exercise.exercise.name} exercise`)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={messages.workoutPage.searchExercise}
          title={messages.workoutPage.searchExercise}
          className="-mr-2 -mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground pointer-coarse:size-11"
        >
          <Search className="h-5 w-5" />
        </a>
      </div>

      {/* Exercise note */}
      {noteOpen ? (
        <textarea
          rows={2}
          value={note}
          autoFocus
          onChange={(e) => {
            setNote(e.target.value)
            onExerciseNoteChange(exercise.id, e.target.value)
          }}
          placeholder={messages.workoutPage.noteForExercise}
          className="mb-4 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : note.trim() ? (
        <p className="mb-4 line-clamp-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{note}</p>
      ) : null}

      {coachUpdate && coachUpdateOpen && coachUpdateMeta && CoachUpdateIcon ? (
        <div className={cn("mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-3", coachUpdateMeta.panelClassName)}>
          <CoachUpdateIcon className={cn("mt-0.5 h-4 w-4 shrink-0", coachUpdateMeta.textClassName)} />
          <span className="text-sm leading-[1.45] text-foreground">{coachUpdate.text}</span>
        </div>
      ) : null}

      {/* Volume recommendation the trainee accepted, shown on the exercise
          that actually drives that muscle's volume. */}
      {coachHint && coachHintText ? (
        // A quiet note rather than a card: it informs, the sets below are the task.
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-primary-soft/70 px-2.5 py-2">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs leading-[1.45] text-muted-foreground">
            {coachHintText}
            {coachHint.action === "increase" ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => onApplyCoachHint(coachHint, exercise.id)}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {messages.volumeRecovery.addTheSet}
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* Sets */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Animation, opened from the thumbnail: a 180px tile at the top of the
            set card, as the old exercise card had it. Playing straight away is
            fine under reduced motion too: the tap was the request. */}
        {media && animationOpen ? (
          <ExerciseAnimation exerciseName={exerciseLabel} media={media} playOnMount />
        ) : null}
        <div
          className={cn(
            "grid min-w-0 items-center pb-1 pt-3",
            SET_ROW_GRID_CLASS,
            "font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground",
          )}
        >
          <span className="min-w-0 text-center">{messages.workoutPage.set}</span>
          <span className="min-w-0 truncate text-center">{messages.workoutPage.previous}</span>
          <span className="min-w-0 text-center">{weightUnit}</span>
          <span className="min-w-0 text-center">{messages.workoutPage.reps}</span>
          <span className="min-w-0 text-center">RIR</span>
          <span />
        </div>

        {/* A hairline between sets so each row reads on its own. */}
        <div className="divide-y divide-border">
          {exercise.sets.map((set, idx) => (
            <SessionSetRow
              key={set.id}
              programTarget={programSetTargets.get(set.id)}
              set={set}
              setIndex={idx}
              weightUnit={weightUnit}
              canRemove={exercise.sets.length > 1}
              active={idx === activeSet}
              onToggle={(data) => {
                onSetUpdate(set.id, data)
                if (data.completed) {
                  onSetComplete(exercise, set, data)
                }
              }}
              onChange={(patch) => onSetUpdate(set.id, patch)}
              onRemove={() => onRemoveSet(exercise.id, set.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onAddSet(exercise.id)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/60"
        >
          <Plus className="h-4 w-4" />
          {messages.workoutPage.addSet}
        </button>
      </div>
    </div>
  )
}
