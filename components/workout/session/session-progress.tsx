"use client"

import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { isExerciseDone } from "@/lib/workout/exercise-order"
import { cn } from "@/lib/utils"

function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/**
 * Session time, ticking every second. Its own component so the tick re-renders
 * this one line rather than the whole session page.
 */
function ElapsedClock({ startTime }: { startTime: Date }) {
  const { messages } = useLocale()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <time
      aria-label={messages.workoutPage.elapsedTime}
      className="font-mono text-xs font-semibold tabular-nums text-primary"
    >
      {formatElapsed((now - startTime.getTime()) / 1000)}
    </time>
  )
}

interface SessionProgressProps {
  exercises: ReadonlyArray<{ id: string; sets: ReadonlyArray<{ completed?: boolean | null }> }>
  exerciseLabels: ReadonlyArray<string>
  currentIndex: number
  onSelect: (index: number) => void
  completedSets: number
  totalSets: number
  volume: number
  weightUnit: "kg" | "lbs"
  startTime: Date
}

/** One segment per exercise in planned order, then the session's numbers. */
export function SessionProgress({
  exercises,
  exerciseLabels,
  currentIndex,
  onSelect,
  completedSets,
  totalSets,
  volume,
  weightUnit,
  startTime,
}: SessionProgressProps) {
  const { locale, messages } = useLocale()
  const doneCount = exercises.filter(isExerciseDone).length

  return (
    <div data-tour="session-stats">
      <nav aria-label={messages.workoutPage.exercises} className="flex items-center gap-1">
        {exercises.map((exercise, index) => {
          const done = isExerciseDone(exercise)
          const current = index === currentIndex
          return (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={current ? "step" : undefined}
              aria-label={messages.workoutPage.exerciseProgressItem(index + 1, exerciseLabels[index] ?? "", done)}
              // The visible bar is thin; the button around it is a tall target.
              className="group flex h-6 min-w-0 flex-1 items-center pointer-coarse:h-8"
            >
              <span
                className={cn(
                  "block w-full rounded-full transition-all duration-200",
                  current ? "h-[5px]" : "h-[3px] group-hover:h-[5px]",
                  current
                    ? "bg-primary shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
                    : done
                      ? "bg-[color-mix(in_srgb,var(--primary)_60%,transparent)]"
                      : "bg-foreground/15",
                )}
              />
            </button>
          )
        })}
      </nav>

      <div className="mt-1 flex items-center justify-between gap-3 font-mono text-xs text-muted-foreground"
      >
        <p className="min-w-0 truncate">
          {messages.workoutPage.exercisePosition(currentIndex + 1, exercises.length)}
          {" · "}
          {messages.workoutPage.exercisesDoneCount(doneCount)}
        </p>
        <p className="flex shrink-0 items-center gap-2.5 tabular-nums">
          <span>{messages.workoutPage.sessionSetsCount(completedSets, totalSets)}</span>
          <span>
            {Math.round(volume).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} {weightUnit}
          </span>
          <ElapsedClock startTime={startTime} />
        </p>
      </div>
    </div>
  )
}
