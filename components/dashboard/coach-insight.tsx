"use client"

import { Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
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
      { onSuccess: () => setAnswered(true) },
    )

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-3 md:flex-row md:items-center md:gap-4 md:px-4 md:py-3">
      <span className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:flex">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="label-micro text-primary">{copy.coachInsight}</p>
        <p className="mt-1 text-sm leading-6 text-foreground">
          {copy.recommendation(
            insight.recommendation.action,
            copy.muscleLabels[insight.muscleSlug as keyof typeof copy.muscleLabels] ?? insight.muscleSlug,
          )}
        </p>
        {answerRecommendation.error ? (
          <p className="mt-2 text-sm text-destructive-text">{answerRecommendation.error.message}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          disabled={answerRecommendation.isPending}
          onClick={() => answer("accepted")}
        >
          {copy.accept}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={answerRecommendation.isPending}
          onClick={() => answer("dismissed")}
        >
          {copy.dismiss}
        </Button>
      </div>
    </section>
  )
}
