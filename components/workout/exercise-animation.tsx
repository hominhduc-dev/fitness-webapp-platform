"use client"

import Image from "next/image"
import { Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"
import type { ExerciseMedia } from "@/lib/types"

interface ExerciseAnimationProps {
  exerciseName: string
  media: ExerciseMedia
  /**
   * Plays straight away even under reduced motion. For media the trainee
   * opened on purpose, where the tap itself is the request to play.
   */
  playOnMount?: boolean
}

function ExerciseAnimation({ exerciseName, media, playOnMount = false }: ExerciseAnimationProps) {
  const { messages } = useLocale()
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  const [manualPlayback, setManualPlayback] = useState(playOnMount)
  const [unavailable, setUnavailable] = useState(false)
  const [sourceWidth, setSourceWidth] = useState<number>(media.width)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      setReducedMotion(query.matches)
      if (!query.matches && !playOnMount) setManualPlayback(false)
    }

    updatePreference()
    query.addEventListener("change", updatePreference)
    return () => query.removeEventListener("change", updatePreference)
  }, [playOnMount])

  if (unavailable) {
    return <p className="sr-only" role="status">{messages.workoutPage.exerciseMediaUnavailable}</p>
  }

  const showAnimation = reducedMotion === false || manualPlayback
  const poster = media.posterUrl ?? media.thumbnailUrl
  const source = showAnimation ? media.animationUrl : poster
  const isVideo = media.type === "video" || media.animationUrl.toLowerCase().endsWith(".mp4")

  const playAnimation = () => {
    setManualPlayback(true)
    requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => undefined)
    })
  }

  const mediaClassName = "block h-auto max-h-[60dvh] w-full object-contain"

  return (
    <figure className="border-b border-border px-4 py-3 md:px-5">
      <div className="flex flex-col items-center">
        <div
          className="w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted/30"
          style={{ maxWidth: Math.min(320, sourceWidth) }}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              aria-label={messages.workoutPage.exerciseAnimationAlt(exerciseName)}
              autoPlay={showAnimation}
              className={mediaClassName}
              loop
              muted
              onError={() => setUnavailable(true)}
              onLoadedMetadata={(event) => {
                if (event.currentTarget.videoWidth > 0) setSourceWidth(event.currentTarget.videoWidth)
              }}
              playsInline
              poster={poster}
              src={showAnimation ? media.animationUrl : undefined}
            />
          ) : (
            <Image
              alt={messages.workoutPage.exerciseAnimationAlt(exerciseName)}
              className={mediaClassName}
              height={media.height}
              loading="eager"
              onError={() => setUnavailable(true)}
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth > 0) setSourceWidth(event.currentTarget.naturalWidth)
              }}
              priority={false}
              src={source}
              unoptimized
              width={media.width}
            />
          )}
        </div>
        {reducedMotion && !manualPlayback ? (
          <Button
            className="mt-2"
            onClick={playAnimation}
            size="sm"
            type="button"
            variant="outline"
          >
            <Play aria-hidden="true" />
            {messages.workoutPage.playExerciseAnimation}
          </Button>
        ) : null}
      </div>
    </figure>
  )
}

export { ExerciseAnimation }
