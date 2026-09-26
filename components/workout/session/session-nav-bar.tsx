"use client"

import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { SlideToConfirm } from "@/components/workout/slide-to-confirm"
import type { PrimaryNavAction } from "@/lib/workout/session-navigation"
import { cn } from "@/lib/utils"

interface SessionNavBarProps {
  action: PrimaryNavAction
  /** Name of the exercise the main button goes to, for "next" and "unfinished". */
  targetLabel: string | null
  canGoBack: boolean
  onBack: () => void
  onGoTo: (index: number) => void
  onCompleteSet: () => void
  onFinish: () => void
  isSaving: boolean
}

/**
 * The pinned bottom bar: back one exercise, and the main action. Fixed to the
 * bottom edge at every size (the session page has no sidebar), its content
 * lined up with the page column.
 */
export function SessionNavBar({
  action,
  targetLabel,
  canGoBack,
  onBack,
  onGoTo,
  onCompleteSet,
  onFinish,
  isSaving,
}: SessionNavBarProps) {
  const { messages } = useLocale()
  const copy = messages.workoutPage
  const finishing = action.kind === "finish" || action.kind === "finishLocked"
  const locked = action.kind === "finishLocked"

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border/60 glass-veil px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:px-10 md:pb-4",
      )}
    >
      {/* 880px column minus its 2.5rem side padding, as in the page's <main>. */}
      <div className="mx-auto flex max-w-[800px] items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label={copy.previousExercise}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-card"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {finishing ? (
          <div data-tour="session-finish" className="min-w-0 flex-1">
            {/* Slide on every screen size: finishing should never fire on a stray click. */}
            <SlideToConfirm
              className="rounded-2xl"
              label={copy.slideToFinish}
              actionLabel={copy.finishWorkout}
              onConfirm={onFinish}
              disabled={locked}
              disabledLabel={copy.finishNeedsAllLogged}
              busy={isSaving}
              busyLabel={copy.saving}
            />
          </div>
        ) : action.kind === "completeSet" ? (
          // Logs the highlighted set with what its row holds, as its tick does.
          <button
            type="button"
            onClick={onCompleteSet}
            className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            <span className="truncate">{copy.completeSetNumber(action.setIndex + 1)}</span>
            <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onGoTo(action.index)}
            className="flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-primary px-5 text-left text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            <span className="truncate">
              {action.kind === "next" ? copy.nextExercise(targetLabel ?? "") : copy.nextUnfinishedExercise(targetLabel ?? "")}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}
