"use client"

import Image from "next/image"
import { Play } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"
import type { ExerciseMedia } from "@/lib/types"

const GYM_VISUAL_URL = "https://gymvisual.com/"

interface ExerciseAnimationProps {
  exerciseName: string
  media: ExerciseMedia
}

function ExerciseAnimation({ exerciseName, media }: ExerciseAnimationProps) {
  const { messages } = useLocale()
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  const [manualPlayback, setManualPlayback] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      setReducedMotion(query.matches)
      if (!query.matches) setManualPlayback(false)
    }

    updatePreference()
    query.addEventListener("change", updatePreference)
    return () => query.removeEventListener("change", updatePreference)
  }, [])

  if (unavailable) {
    return <p className="sr-only" role="status">{messages.workoutPage.exerciseMediaUnavailable}</p>
  }

  const showAnimation = reducedMotion === false || manualPlayback
  const source = showAnimation ? media.animationUrl : media.thumbnailUrl

  return (
    <figure className="border-b border-border px-4 py-3 md:px-5">
      <div className="flex flex-col items-center">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <Image
            alt={messages.workoutPage.exerciseAnimationAlt(exerciseName)}
            className="h-[180px] w-[180px] object-cover"
            height={media.height}
            loading="eager"
            onError={() => setUnavailable(true)}
            priority={false}
            src={source}
            unoptimized
            width={media.width}
          />
        </div>
        {reducedMotion && !manualPlayback ? (
          <Button
            className="mt-2"
            onClick={() => setManualPlayback(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Play aria-hidden="true" />
            {messages.workoutPage.playExerciseAnimation}
          </Button>
        ) : null}
        <figcaption className="mt-2 text-xs text-muted-foreground">
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={GYM_VISUAL_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            © Gym visual
          </a>
        </figcaption>
      </div>
    </figure>
  )
}

export { ExerciseAnimation, GYM_VISUAL_URL }
