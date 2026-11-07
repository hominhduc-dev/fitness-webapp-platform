"use client"

import { Sparkles, X } from "lucide-react"
import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import type { VolumeRecoveryMuscle } from "@/lib/fitness/types"
import { useSetVolumeRecommendationStatus, useVolumeRecovery } from "@/lib/queries/progress"

const actionPriority = { deload: 0, decrease: 1, increase: 2, maintain: 3 } as const

/**
 * The most urgent recommendation the trainee has not answered yet, so the
 * dashboard shows one decision at a time instead of a list.
 */
function selectPendingInsight(muscles: VolumeRecoveryMuscle[] | undefined) {
  return (
    muscles
      ?.filter((muscle) => muscle.recommendation.status === "pending")
      .sort(
        (left, right) => actionPriority[left.recommendation.action] - actionPriority[right.recommendation.action],
      )[0] ?? null
  )
}

export function CoachInsightCard() {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const { toast } = useToast()
  const query = useVolumeRecovery()
  const answerRecommendation = useSetVolumeRecommendationStatus()
  // Answering hides the card for the rest of this visit; the next pending
  // recommendation surfaces on the following load rather than replacing it
  // under the trainee's finger.
  const [answered, setAnswered] = useState(false)
  const data = query.data
  const insight = useMemo(() => selectPendingInsight(data?.muscles), [data])

  if (!data || !insight || answered) return null

  const answer = (status: "accepted" | "dismissed") =>
    answerRecommendation.mutate(
      { muscleSlug: insight.muscleSlug, status, weekStart: data.weekStart },
      { onSuccess: () => {
        setAnswered(true)
        if (status === "accepted") toast({ title: copy.recommendationAcknowledged, tone: "success" })
      } },
    )

  const message = copy.recommendation(
    insight.recommendation.action,
    copy.muscleLabels[insight.muscleSlug as keyof typeof copy.muscleLabels] ?? insight.muscleSlug,
  )

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary-soft px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <p className="label-micro text-primary">{copy.coachInsight}</p>
            <Button type="button" disabled={answerRecommendation.isPending} onClick={() => answer("accepted")} variant="ghost" size="sm" className="-my-1 h-9 shrink-0 px-2 text-xs text-primary pointer-coarse:min-h-11">
              {copy.acknowledgeRecommendation}
            </Button>
          </div>
          <p className="text-sm leading-5 text-foreground">{message}</p>
        </div>
        <button
          type="button"
          aria-label={copy.dismiss}
          title={copy.dismiss}
          disabled={answerRecommendation.isPending}
          onClick={() => answer("dismissed")}
          className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-50 pointer-coarse:-mt-2 pointer-coarse:-mr-2 pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {answerRecommendation.error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive-text">{answerRecommendation.error.message}</p>
      ) : null}
    </section>
  )
}
