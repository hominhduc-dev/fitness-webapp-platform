"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import {
  INTENSITY_TAGS,
  INTENSITY_TAG_BADGES,
  normalizeSetIntensityAssignments,
  type IntensityTag,
  type SetIntensityAssignment,
} from "@/lib/workout/intensity-tag"

export function getIntensityTagLabel(tag: IntensityTag, messages: AppMessages) {
  const labels: Record<IntensityTag, string> = {
    cluster: messages.workoutPage.intensityTagCluster,
    drop_set: messages.workoutPage.intensityTagDropSet,
    failure: messages.workoutPage.intensityTagFailure,
    mrm: messages.workoutPage.intensityTagMrm,
    rest_pause: messages.workoutPage.intensityTagRestPause,
    warmup: messages.workoutPage.intensityTagWarmup,
  }

  return labels[tag]
}

/**
 * The whole trainee-facing surface of the feature: a short badge next to the set
 * number. Everything else about a tagged set logs exactly like a normal one.
 */
export function IntensityTagBadge({ className, tag }: { className?: string; tag: IntensityTag }) {
  return (
    <span
      className={cn(
        "rounded-full bg-primary px-1.5 py-px font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-primary-foreground",
        className,
      )}
    >
      {INTENSITY_TAG_BADGES[tag]}
    </span>
  )
}

type SetIntensityTagPickerProps = {
  className?: string
  messages: AppMessages
  onChange: (assignments: SetIntensityAssignment[]) => void
  setCount: number
  value: SetIntensityAssignment[] | undefined
}

/**
 * Coach-side control: one round chip per set, numbered, each opening the method
 * list. A tagged set turns primary and carries its badge.
 *
 * The chips are 28px so five sets still share a row with the note on a phone;
 * `tap-target` gives each an invisible 44px hit area on touch screens.
 *
 * The chips are rendered from `setCount`, so shrinking an exercise drops the
 * chips for the sets that no longer exist — and the assignments with them, via
 * the same normalisation the service applies when saving.
 */
export function SetIntensityTagPicker({ className, messages, onChange, setCount, value }: SetIntensityTagPickerProps) {
  const sets = Math.max(0, Math.min(20, Math.round(setCount) || 0))
  const assignments = normalizeSetIntensityAssignments(value, sets)
  const tagBySetNumber = new Map(assignments.map(({ setNumber, tag }) => [setNumber, tag]))

  if (sets === 0) return null

  const select = (setNumber: number, tag: IntensityTag | null) => {
    const next = assignments.filter((assignment) => assignment.setNumber !== setNumber)

    onChange(normalizeSetIntensityAssignments(tag ? [...next, { setNumber, tag }] : next, sets))
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
        {messages.workoutPage.intensityMethodLabel}
      </span>
      {/* pt-2 leaves room for the method badge that floats above a tagged chip. */}
      <div className="flex flex-wrap items-center gap-1 pt-2">
      {Array.from({ length: sets }, (_value, index) => {
        const setNumber = index + 1
        const tag = tagBySetNumber.get(setNumber)

        return (
          <DropdownMenu key={setNumber}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={
                  tag
                    ? messages.workoutPage.intensitySetMethodLabel(setNumber, getIntensityTagLabel(tag, messages))
                    : messages.workoutPage.intensitySetMethodLabel(setNumber, messages.workoutPage.intensityNormalSet)
                }
                className={cn(
                  "tap-target relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tnum transition-colors",
                  tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {setNumber}
                {/* The badge floats above the chip instead of widening it, so a
                    tagged set stays 28px and five sets still fit beside the note. */}
                {tag ? (
                  <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-card px-1 font-mono text-[8px] font-semibold leading-3 tracking-[0.04em] text-primary">
                    {INTENSITY_TAG_BADGES[tag]}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            {/* Above the routine builder dialog (z-[90]) that hosts this picker. */}
            <DropdownMenuContent align="start" className="z-[100] w-48">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {messages.workoutPage.intensitySetChip(setNumber)}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => select(setNumber, null)}>
                {messages.workoutPage.intensityNormalSet}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {INTENSITY_TAGS.map((option) => (
                <DropdownMenuItem key={option} onClick={() => select(setNumber, option)}>
                  <span className="mr-2 font-mono text-micro font-semibold text-muted-foreground">
                    {INTENSITY_TAG_BADGES[option]}
                  </span>
                  {getIntensityTagLabel(option, messages)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
      </div>
    </div>
  )
}
