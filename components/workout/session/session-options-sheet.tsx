"use client"

import { Check, FileText, Plus, Repeat, SkipForward, Trash2, X, type LucideIcon } from "lucide-react"
import { useId, type ReactNode } from "react"

import { SingleChoice } from "@/components/ai/choice-controls"
import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody } from "@/components/ui/bottom-sheet"
import { cn } from "@/lib/utils"
import { DEFAULT_REST_OPTIONS, type DefaultRestSeconds } from "@/lib/workout/use-default-rest"

function SheetSection({ title, children, first = false }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <section className={cn(!first && "mt-2 border-t border-border pt-4")}>
      <h3 className="mb-1 font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function SheetAction({
  icon: Icon,
  label,
  hint,
  destructive = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
    >
      <Icon className={cn("h-5 w-5 shrink-0", destructive ? "text-destructive-text" : "text-primary")} aria-hidden="true" />
      <span className="min-w-0">
        <span className={cn("block text-[15px] font-medium", destructive ? "text-destructive-text" : "text-foreground")}>
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  )
}

interface SessionOptionsSheetProps {
  onClose: () => void
  hasExercise: boolean
  hasNote: boolean
  canSkip: boolean
  completedSets: number
  totalSets: number
  defaultRest: DefaultRestSeconds
  onDefaultRestChange: (seconds: DefaultRestSeconds) => void
  onSwap: () => void
  onNote: () => void
  onSkip: () => void
  onRemoveExercise: () => void
  onAddExercise: () => void
  onFinishEarly: () => void
  onCancelWorkout: () => void
}

/**
 * Everything that is not logging a set, behind the header's "…": the current
 * exercise, the default rest, and the session itself. Each action closes the
 * sheet before it runs, so a dialog it opens is not stacked under the sheet.
 */
export function SessionOptionsSheet({
  onClose,
  hasExercise,
  hasNote,
  canSkip,
  completedSets,
  totalSets,
  defaultRest,
  onDefaultRestChange,
  onSwap,
  onNote,
  onSkip,
  onRemoveExercise,
  onAddExercise,
  onFinishEarly,
  onCancelWorkout,
}: SessionOptionsSheetProps) {
  const { messages } = useLocale()
  const copy = messages.workoutPage
  const titleId = useId()
  const run = (action: () => void) => () => {
    onClose()
    action()
  }

  return (
    // Above the rest timer chip (z-50), which otherwise floats over the last rows.
    <BottomSheet onClose={onClose} variant="flush" labelledBy={titleId} overlayClassName="z-[60]">
      <h2 id={titleId} className="sr-only">{copy.sessionOptions}</h2>
      <BottomSheetBody className="pt-3">
        {hasExercise ? (
          <SheetSection title={copy.optionsCurrentExercise} first>
            <SheetAction icon={Repeat} label={copy.swapExercise} hint={copy.swapExerciseHint} onClick={run(onSwap)} />
            <SheetAction icon={FileText} label={hasNote ? copy.editNote : copy.addNote} onClick={run(onNote)} />
            {canSkip ? <SheetAction icon={SkipForward} label={copy.skipExercise} onClick={run(onSkip)} /> : null}
            <SheetAction icon={Trash2} label={copy.removeExerciseFromSession} destructive onClick={run(onRemoveExercise)} />
          </SheetSection>
        ) : null}

        <SheetSection title={copy.defaultRestTitle} first={!hasExercise}>
          <div className="mt-2">
            <SingleChoice<DefaultRestSeconds>
              ariaLabel={copy.defaultRestTitle}
              mono
              value={defaultRest}
              onChange={onDefaultRestChange}
              options={DEFAULT_REST_OPTIONS.map((seconds) => ({
                label: seconds < 120 ? copy.restSeconds(seconds) : copy.restMinutes(seconds / 60),
                value: seconds,
              }))}
            />
          </div>
          <p className="mb-2 mt-2 text-xs text-muted-foreground">{copy.defaultRestHint}</p>
        </SheetSection>

        <SheetSection title={copy.optionsSession}>
          <SheetAction icon={Plus} label={copy.addExercise} onClick={run(onAddExercise)} />
          <SheetAction
            icon={Check}
            label={copy.finishEarly}
            hint={copy.finishEarlyHint(completedSets, totalSets)}
            onClick={run(onFinishEarly)}
          />
          <SheetAction icon={X} label={copy.cancelWorkout} destructive onClick={run(onCancelWorkout)} />
        </SheetSection>
      </BottomSheetBody>
    </BottomSheet>
  )
}
