"use client"

import { Check, ChevronRight } from "lucide-react"

import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { useLocale } from "@/components/providers/locale-provider"
import { useTargetSummary } from "@/components/workout/session/session-exercise-view"
import type { ProgramSetTarget } from "@/components/workout/session/session-set-row"
import type { WorkoutExercise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { exerciseQueue } from "@/lib/workout/exercise-order"

/** Mount animation for cards joining the stack; off under reduced motion. */
const ENTER_CLASS_NAME = "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"

function completedCount(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.completed).length
}

function QueueCard({
  exercise,
  label,
  first,
  programSetTargets,
  onSelect,
}: {
  exercise: WorkoutExercise
  label: string
  first: boolean
  programSetTargets: ReadonlyMap<string, ProgramSetTarget>
  onSelect: () => void
}) {
  const { messages } = useLocale()
  const summary = useTargetSummary(exercise, programSetTargets)
  const completed = completedCount(exercise)

  return (
    <li className={ENTER_CLASS_NAME}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={messages.workoutPage.queueOpenExercise(label)}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left transition-colors",
          "outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
          // The head of the queue reads as the next card in the stack.
          first ? "border-[color-mix(in_srgb,var(--primary)_35%,var(--border))]" : "border-border",
        )}
      >
        <ExerciseThumbnail media={exercise.variation.media} name={label} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight text-foreground">{label}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        {completed > 0 ? (
          // Started earlier, then skipped: how far it got.
          <span className="shrink-0 font-mono text-micro tabular-nums text-primary">
            {messages.workoutPage.queueSetsProgress(completed, exercise.sets.length)}
          </span>
        ) : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  )
}

function DoneRow({ exercise, label, onSelect }: { exercise: WorkoutExercise; label: string; onSelect: () => void }) {
  const { messages } = useLocale()

  return (
    <li className={ENTER_CLASS_NAME}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={messages.workoutPage.queueOpenExercise(label)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
          {messages.workoutPage.queueSetsProgress(completedCount(exercise), exercise.sets.length)}
        </span>
      </button>
    </li>
  )
}

function QueueHeading({ children }: { children: string }) {
  return (
    <h3 className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
  )
}

interface SessionExerciseQueueProps {
  exercises: ReadonlyArray<WorkoutExercise>
  exerciseLabels: ReadonlyArray<string>
  currentIndex: number
  programSetTargets: ReadonlyMap<string, ProgramSetTarget>
  onSelect: (index: number) => void
}

/**
 * The stack layout's queue, under the current exercise: what is left as
 * collapsed cards in the order the session bar reaches them, then what is done
 * as one line each. Any card opens that exercise on top of the stack.
 */
export function SessionExerciseQueue({
  exercises,
  exerciseLabels,
  currentIndex,
  programSetTargets,
  onSelect,
}: SessionExerciseQueueProps) {
  const { messages } = useLocale()
  const { upNext, done } = exerciseQueue(exercises, currentIndex)

  if (upNext.length === 0 && done.length === 0) return null

  return (
    // The bottom margin lets the last row scroll clear of the rest timer chip,
    // which floats above the pinned bar.
    <div className="mb-16 mt-6 space-y-5">
      {upNext.length > 0 ? (
        <section>
          <QueueHeading>{messages.workoutPage.queueUpNext}</QueueHeading>
          <ol className="space-y-2">
            {upNext.map((index, position) => (
              <QueueCard
                key={exercises[index].id}
                exercise={exercises[index]}
                label={exerciseLabels[index] ?? ""}
                first={position === 0}
                programSetTargets={programSetTargets}
                onSelect={() => onSelect(index)}
              />
            ))}
          </ol>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section>
          <QueueHeading>{messages.workoutPage.queueDone}</QueueHeading>
          <ol className="space-y-0.5">
            {done.map((index) => (
              <DoneRow
                key={exercises[index].id}
                exercise={exercises[index]}
                label={exerciseLabels[index] ?? ""}
                onSelect={() => onSelect(index)}
              />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
