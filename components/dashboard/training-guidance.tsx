"use client"

import { CircleCheck, CircleSlash, TrendingDown, TriangleAlert } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { TrainingGuidanceAction } from "@/lib/fitness/types"
import { useVolumeRecovery } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const GUIDANCE_STYLE: Record<TrainingGuidanceAction, { className: string; icon: typeof CircleCheck }> = {
  light_session: { className: "border-warning/25 bg-warning-soft text-warning-text", icon: TrendingDown },
  proceed: { className: "border-success/25 bg-success-soft text-success-text", icon: CircleCheck },
  reduce_volume: { className: "border-warning/25 bg-warning-soft text-warning-text", icon: TriangleAlert },
  rest: { className: "border-destructive/25 bg-destructive-soft text-destructive-text", icon: CircleSlash },
}

/**
 * Turns the recovery signals into one instruction about the session the trainee
 * is looking at. It adjusts the plan rather than replacing it, so it sits on the
 * workout card instead of proposing a workout of its own.
 */
export function TrainingGuidance() {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const query = useVolumeRecovery()
  const guidance = query.data?.guidance

  if (!guidance) return null

  const style = GUIDANCE_STYLE[guidance.action]
  const Icon = style.icon
  const reasons = guidance.reasons.map((reason) => copy.guidanceReason[reason]).filter(Boolean)
  const focusMuscles = guidance.focusMuscles.map(
    (slug) => copy.muscleLabels[slug as keyof typeof copy.muscleLabels] ?? slug,
  )

  return (
    <div className={cn("rounded-2xl border px-4 py-3", style.className)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{copy.guidance[guidance.action]}</p>
            {guidance.setAdjustmentPct !== 0 ? (
              <span className="font-mono text-micro tnum opacity-80">
                {copy.guidanceSetAdjustment(guidance.setAdjustmentPct)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-foreground">{copy.guidanceDetail[guidance.action]}</p>
          {reasons.length > 0 ? (
            <p className="mt-1.5 text-micro opacity-80">{reasons.join(" · ")}</p>
          ) : null}
          {focusMuscles.length > 0 ? (
            <p className="mt-1 text-micro font-medium text-foreground">{focusMuscles.join(", ")}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
