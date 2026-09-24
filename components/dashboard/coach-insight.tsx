"use client"

import { Sparkles, X } from "lucide-react"
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

  const message = copy.recommendation(
    insight.recommendation.action,
    copy.muscleLabels[insight.muscleSlug as keyof typeof copy.muscleLabels] ?? insight.muscleSlug,
  )

  // Two rows: the label with a dismiss ✕, then the advice beside Apply — so the
  // advice keeps nearly the full width and wraps to two lines at most on a phone.
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary-soft px-3 py-2.5 md:px-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="label-micro min-w-0 flex-1 truncate text-primary">{copy.coachInsight}</p>
        <button
          type="button"
          aria-label={copy.dismiss}
          title={copy.dismiss}
          disabled={answerRecommendation.isPending}
          onClick={() => answer("dismissed")}
          // A 44px target on touch, pulled back into the row so it stays short.
          className="-my-1.5 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-50 pointer-coarse:-my-2.5 pointer-coarse:-mr-2.5 pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm leading-5 text-foreground">{message}</p>
        <Button
          type="button"
          disabled={answerRecommendation.isPending}
          onClick={() => answer("accepted")}
          className="h-9 shrink-0 rounded-xl px-3.5"
        >
          {copy.accept}
        </Button>
      </div>
      {answerRecommendation.error ? (
        <p className="mt-1.5 text-xs text-destructive-text">{answerRecommendation.error.message}</p>
      ) : null}
    </section>
  )
}
