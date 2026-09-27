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

const SIDE_SLUGS: Record<BodySide, ReadonlySet<string>> = {
  back: new Set(BACK_BODY_PARTS.map((part) => part.slug)),
  front: new Set(FRONT_BODY_PARTS.map((part) => part.slug)),
}

// Drawn on both sides, but read best from behind: a calf raise shows the
// gastrocnemius, not the shin.
const BACK_ON_TIE: ReadonlySet<string> = new Set(["calves"])

/**
 * The side of a single-view figure that shows the most of `slugs`: the back
 * for back and leg work, the front for arms and chest. On a tie it stays on the
 * front unless every muscle reads better from behind (calves).
 */
export function preferredBodySide(slugs: readonly string[]): BodySide {
  const front = slugs.filter((slug) => SIDE_SLUGS.front.has(slug)).length
  const back = slugs.filter((slug) => SIDE_SLUGS.back.has(slug)).length
  if (back !== front) return back > front ? "back" : "front"
  return slugs.length > 0 && slugs.every((slug) => BACK_ON_TIE.has(slug)) ? "back" : "front"
}

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
  /** With `onMuscleClick`: muscles shown as chosen, reported as `aria-pressed`. */
  selectedSlugs?: ReadonlySet<string>
  /** With `onMuscleClick`: the accessible name of each muscle button. */
  getMuscleLabel?: (slug: MuscleSlug) => string
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
  defaultFill = "var(--body-fill)",
  outline = "var(--body-line)",
  onMuscleClick,
  selectedSlugs,
  getMuscleLabel,
  label,
  className,
}: MuscleMapProps) {
  const { parts, viewBox } = SIDE_CONFIG[side]
  const interactive = Boolean(onMuscleClick)

  // Each muscle contributes up to three path groups (common / left / right),
  // flattened once per render into the paths drawn for it.
  const muscles = useMemo(
    () =>
      parts.map(({ path, slug }) => ({
        paths: [...(path.common ?? []), ...(path.left ?? []), ...(path.right ?? [])],
        slug,
      })),
    [parts],
  )

  return (
    <svg
      viewBox={viewBox}
      className={cn("h-auto w-full", className)}
      // A picture to look at, or — clickable — a group of muscle buttons.
      role={interactive ? "group" : "img"}
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

      {muscles.map(({ paths, slug }) => {
        const shapes = paths.map((d, index) => (
          <path
            key={`${slug}-${index}`}
            d={d}
            // Names the region in the DOM. The artwork is 750-odd anonymous
            // paths otherwise, which makes both end-to-end selection and
            // eyeballing the tree in devtools guesswork.
            data-muscle={slug}
            fill={highlights?.[slug] ?? defaultFill}
          />
        ))

        if (!interactive || DECORATIVE_SLUGS.has(slug)) {
          return <g key={slug}>{shapes}</g>
        }

        // One button per muscle, however many paths draw it, so it is a single
        // stop for Tab and a single name for a screen reader.
        return (
          <g
            key={slug}
            role="button"
            tabIndex={0}
            aria-label={getMuscleLabel?.(slug) ?? slug}
            aria-pressed={selectedSlugs ? selectedSlugs.has(slug) : undefined}
            onClick={() => onMuscleClick?.(slug)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              onMuscleClick?.(slug)
            }}
            // Fading rather than recolouring on hover keeps the affordance
            // independent of `highlights` — the caller owns the palette, and a
            // fixed hover colour would fight whichever scale it picked.
            className="cursor-pointer outline-none transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:[&>path]:stroke-foreground focus-visible:[&>path]:[stroke-width:3px]"
          >
            {shapes}
          </g>
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
