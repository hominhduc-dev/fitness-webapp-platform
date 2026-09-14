"use client"

import Image from "next/image"
import { Dumbbell, Play } from "lucide-react"
import { useState, type ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ExerciseAnimation } from "@/components/workout/exercise-animation"
import type { ExerciseMedia } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: { className: "size-10 rounded-md", pixels: 40 },
  md: { className: "size-12 rounded-lg", pixels: 48 },
} as const

const FRAME_CLASS_NAME =
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-subtle text-muted-foreground"

/**
 * The static thumbnail of an exercise for lists and cards. Animations never
 * autoplay here: a list can hold thousands of rows, so only the lightweight
 * thumbnail loads, lazily.
 *
 * With `previewable`, the thumbnail becomes a button that opens the animation
 * in a dialog. Leave it off wherever the thumbnail already sits inside another
 * button (a picker row, a card header), since buttons cannot nest.
 *
 * Exercises without media, or whose image fails to load, show an icon instead.
 */
export function ExerciseThumbnail({
  className,
  media,
  name,
  previewable = false,
  size = "sm",
}: {
  className?: string
  media?: ExerciseMedia
  name: string
  previewable?: boolean
  size?: keyof typeof SIZES
}) {
  const [failed, setFailed] = useState(false)
  const { className: sizeClassName, pixels } = SIZES[size]
  const frameClassName = cn(FRAME_CLASS_NAME, sizeClassName, className)

  if (!media || failed) {
    return (
      <span aria-hidden="true" className={frameClassName} data-slot="exercise-thumbnail">
        <Dumbbell className="size-1/2" />
      </span>
    )
  }

  // Decorative: the exercise name is always rendered next to the thumbnail.
  const image = (
    <Image
      alt=""
      className="size-full object-cover"
      height={pixels}
      loading="lazy"
      onError={() => setFailed(true)}
      src={media.thumbnailUrl}
      unoptimized
      width={pixels}
    />
  )

  if (!previewable) {
    return (
      <span aria-hidden="true" className={frameClassName} data-slot="exercise-thumbnail">
        {image}
      </span>
    )
  }

  return (
    <ExerciseThumbnailPreview className={frameClassName} media={media} name={name}>
      {image}
    </ExerciseThumbnailPreview>
  )
}

/**
 * The previewable variant lives in its own component so only it needs the
 * locale; static thumbnails render anywhere, with no provider around them.
 */
function ExerciseThumbnailPreview({
  children,
  className,
  media,
  name,
}: {
  children: ReactNode
  className: string
  media: ExerciseMedia
  name: string
}) {
  const { messages } = useLocale()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={`${messages.workoutPage.playExerciseAnimation}: ${name}`}
        className={cn(className, "group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        data-slot="exercise-thumbnail"
        onClick={() => setOpen(true)}
      >
        {children}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-overlay-soft opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Play className="size-4 text-inverse-foreground" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Thumbnails also live inside other dialogs (the schedule preview at
            z-[95], the add-exercise sheet at z-[110]), so the animation dialog
            has to stack above the highest of them. */}
        <DialogContent className="z-[130] gap-0 p-0 sm:max-w-sm" overlayClassName="z-[125]">
          <DialogHeader className="px-5 pb-2 pt-5 text-left">
            <DialogTitle className="pr-8 text-base">{name}</DialogTitle>
            <DialogDescription className="sr-only">{messages.workoutPage.exerciseAnimationAlt(name)}</DialogDescription>
          </DialogHeader>
          {open ? <ExerciseAnimation exerciseName={name} media={media} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
