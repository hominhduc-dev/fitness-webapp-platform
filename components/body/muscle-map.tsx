"use client"

import { useMemo } from "react"

import { BODY_OUTLINE } from "@/components/body/muscle-outline"
import { BACK_BODY_PARTS, BACK_VIEW_BOX, type BackMuscleSlug } from "@/components/body/muscle-paths.back"
import { FRONT_BODY_PARTS, FRONT_VIEW_BOX, type FrontMuscleSlug } from "@/components/body/muscle-paths.front"
import { cn } from "@/lib/utils"

export type MuscleSlug = BackMuscleSlug | FrontMuscleSlug

export type BodySide = "back" | "front"

/**
 * Slugs the artwork carries but that no training feature should ever colour in.
 * Hair and head are drawn so the figure reads as a person, not so we can claim
 * someone trained their scalp; hands and feet are grip/contact surfaces, not
 * muscle groups the app tracks.
 */
const DECORATIVE_SLUGS: ReadonlySet<string> = new Set(["ankles", "feet", "hair", "hands", "head", "knees", "neck"])

const SIDE_CONFIG = {
  back: { parts: BACK_BODY_PARTS, viewBox: BACK_VIEW_BOX },
  front: { parts: FRONT_BODY_PARTS, viewBox: FRONT_VIEW_BOX },
} as const

interface MuscleMapProps {
  side: BodySide
  /**
   * Slug -> fill. Any CSS colour works, including `var(--chart-1)`, so callers
   * decide the scale: a single accent for "trained this week", or one colour per
   * tier for the level view. Slugs left out fall back to `defaultFill`.
   */
  highlights?: Partial<Record<MuscleSlug, string>>
  /** Fill for muscles with no entry in `highlights`. */
  defaultFill?: string
  /** Stroke for the body silhouette. Pass `null` to drop it (thumbnails). */
  outline?: string | null
  onMuscleClick?: (slug: MuscleSlug) => void
  /** Accessible name for the figure as a whole. */
  label?: string
  className?: string
}

/**
 * Anatomical body map. Renders the front or back view as one inline SVG, with
 * every muscle region individually fillable.
 *
 * The artwork is a 724x1448 box per side, and both sides live in one 1448-wide
 * coordinate space (front on the left, back on the right) — hence the differing
 * viewBox origins. Nothing here is sized in pixels: the SVG fills its container
 * and keeps its aspect ratio, so the same component serves the full-width
 * statistics card and a 64px thumbnail.
 */
export function MuscleMap({
  side,
  highlights,
  defaultFill = "var(--muted)",
  outline = "var(--border)",
  onMuscleClick,
  label,
  className,
}: MuscleMapProps) {
  const { parts, viewBox } = SIDE_CONFIG[side]

  // Each muscle contributes up to three path groups (common / left / right).
  // Flattening once per render keeps the JSX below a single map.
  const shapes = useMemo(
    () =>
      parts.flatMap(({ path, slug }) =>
        [...(path.common ?? []), ...(path.left ?? []), ...(path.right ?? [])].map((d, index) => ({
          d,
          key: `${slug}-${index}`,
          slug,
        })),
      ),
    [parts],
  )

  return (
    <svg
      viewBox={viewBox}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={label ?? `Body map, ${side} view`}
    >
      {outline !== null && (
        <path
          d={BODY_OUTLINE[side]}
          fill="none"
          stroke={outline}
          strokeWidth={2}
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {shapes.map(({ d, key, slug }) => {
        const isInteractive = Boolean(onMuscleClick) && !DECORATIVE_SLUGS.has(slug)

        return (
          <path
            key={key}
            d={d}
            fill={highlights?.[slug] ?? defaultFill}
            onClick={isInteractive ? () => onMuscleClick?.(slug) : undefined}
            className={isInteractive ? "cursor-pointer" : undefined}
          />
        )
      })}
    </svg>
  )
}

/** Slugs that represent trainable muscle, in the order they appear on the body. */
export const TRAINABLE_MUSCLE_SLUGS = [
  ...new Set(
    [...FRONT_BODY_PARTS, ...BACK_BODY_PARTS].map((part) => part.slug).filter((slug) => !DECORATIVE_SLUGS.has(slug)),
  ),
].sort() as MuscleSlug[]
