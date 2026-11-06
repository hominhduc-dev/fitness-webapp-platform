"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import {
  INTENSITY_TAGS,
  INTENSITY_TAG_BADGES,
  hasTopBackoffScheme,
  setIntensityMethodAssignments,
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
    top_set: messages.workoutPage.intensityTagTopSet,
    back_off: messages.workoutPage.intensityTagBackoff,
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
  disabled?: boolean
}

/** Compact numbered method chips; the tag badge doesn't widen the row. */
export function SetIntensityTagPicker({ className, messages, onChange, setCount, value, disabled }: SetIntensityTagPickerProps) {
  const t = messages.workoutPage
  const sets = Math.max(0, Math.min(100, Math.floor(setCount) || 0))
  const assignments = normalizeSetIntensityAssignments(value, sets)
  const tagBySet = new Map(assignments.map(({ setNumber, tag }) => [setNumber, tag]))

  const combined = hasTopBackoffScheme(assignments, sets)

  if (!sets) return null
  return <div className={cn("flex min-w-0 flex-col gap-1", className)} role="group" aria-label={t.intensityMethodLabel}>
    <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{t.intensityMethodLabel}</span>
    <div className="flex flex-wrap items-center gap-x-1 gap-y-3 pt-2">
      {Array.from({ length: sets }, (_, index) => {
        const setNumber = index + 1
        const tag = tagBySet.get(setNumber)
        const derived = combined && setNumber > 1
        const label = tag ? getIntensityTagLabel(tag, messages) : t.intensityNormalSet
        const triggerLabel = t.intensitySetMethodLabel(setNumber, label)
        return <DropdownMenu key={setNumber}>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={disabled || derived} aria-label={derived ? `${triggerLabel}. ${t.intensityBackoffDerivedHint}` : triggerLabel} title={derived ? t.intensityBackoffDerivedHint : undefined} className={cn("tap-target relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tnum transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", derived && !disabled && "disabled:opacity-100", tag ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
              {setNumber}
              {tag ? <span aria-hidden className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-card px-1 font-mono text-[8px] font-semibold leading-3 tracking-[0.04em] text-primary">{INTENSITY_TAG_BADGES[tag]}</span> : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[100] w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t.intensitySetChip(setNumber)}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={tag ?? "normal"} onValueChange={(method) => onChange(setIntensityMethodAssignments(assignments, sets, setNumber, method === "normal" ? null : method as IntensityTag))}>
              <DropdownMenuRadioItem value="normal" className="pointer-coarse:min-h-11">{t.intensityNormalSet}</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {setNumber === 1 ? <DropdownMenuRadioItem value="top_set" className="pointer-coarse:min-h-11">{t.topBackoffPreset}</DropdownMenuRadioItem> : null}
              {INTENSITY_TAGS.filter((method) => method !== "top_set" && method !== "back_off").map((method) => <DropdownMenuRadioItem key={method} value={method} className="pointer-coarse:min-h-11">
                <span aria-hidden className="font-mono text-micro font-semibold text-muted-foreground">{INTENSITY_TAG_BADGES[method]}</span>
                {getIntensityTagLabel(method, messages)}
              </DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      })}
    </div>
  </div>
}
