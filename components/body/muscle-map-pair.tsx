"use client"

import { MuscleMap, type MuscleSlug } from "@/components/body/muscle-map"
import { cn } from "@/lib/utils"

/**
 * Front and back views side by side — the only way the body map is ever shown,
 * since most muscle groups land on one side or the other and a single view
 * silently drops half the answer (Back highlights nothing on the front figure).
 */

const SIZE_CLASS = {
  // Thumbnail: routine cards and the builder dialog header, where the map sits
  // beside a title and must not compete with it.
  sm: "w-[38px]",
  // Full card: sized for the 360px right-hand column on the progress page.
  md: "w-[120px]",
} as const

interface MuscleMapPairProps {
  highlights?: Partial<Record<MuscleSlug, string>>
  size?: keyof typeof SIZE_CLASS
  /** Describes what the pair represents, e.g. "Muscles trained this week". */
  label: string
  className?: string
}

export function MuscleMapPair({ highlights, size = "md", label, className }: MuscleMapPairProps) {
  return (
    <div className={cn("flex shrink-0 items-start justify-center gap-1.5", className)} role="group" aria-label={label}>
      {(["front", "back"] as const).map((side) => (
        <MuscleMap
          key={side}
          side={side}
          highlights={highlights}
          label={`${label} — ${side}`}
          className={SIZE_CLASS[size]}
        />
      ))}
    </div>
  )
}
