"use client"

import { X } from "lucide-react"
import { useState } from "react"

import { SingleChoice } from "@/components/ai/choice-controls"
import {
  MuscleMap,
  TRAINABLE_MUSCLE_SLUGS,
  preferredBodySide,
  type BodySide,
  type MuscleSlug,
} from "@/components/body/muscle-map"
import { useLocale } from "@/components/providers/locale-provider"

/** Sore, from mild to severe — the check-in scale without its "not sore" 0. */
export type SorenessLevel = 2 | 3 | 4 | 5
export type SorenessByMuscle = Partial<Record<MuscleSlug, SorenessLevel>>

/** What a freshly tapped muscle starts at: the middle of the scale. */
export const DEFAULT_SORENESS_LEVEL: SorenessLevel = 3

const SORENESS_FILL: Record<SorenessLevel, string> = {
  2: "color-mix(in srgb, var(--warning) 45%, var(--body-fill))",
  3: "var(--warning)",
  4: "color-mix(in srgb, var(--destructive) 65%, var(--warning))",
  5: "var(--destructive)",
}
const TRAINED_FILL = "color-mix(in srgb, var(--primary) 22%, var(--body-fill))"

/** Map colour for a soreness level: warm and light when mild, red when severe. */
export function sorenessFill(level: SorenessLevel) {
  return SORENESS_FILL[level]
}

type SorenessRating = { muscleSlug: MuscleSlug; soreness: number }

/**
 * The check-in's `muscles`. Answered, it rates every muscle — the tapped ones
 * at their level and the rest at 0 — so "nothing is sore" reaches readiness as
 * a real answer. Skipped, it is empty and readiness leaves soreness out.
 */
export function buildSorenessPayload(value: SorenessByMuscle, answered: boolean): SorenessRating[] {
  if (!answered) return []
  return TRAINABLE_MUSCLE_SLUGS.map((muscleSlug) => ({ muscleSlug, soreness: value[muscleSlug] ?? 0 }))
}

/** The sorest muscle in a saved check-in, or null when none is sore. */
export function sorestMuscle<T extends { muscleSlug: string; soreness: number }>(muscles: readonly T[]) {
  return muscles.reduce<T | null>(
    (sorest, muscle) => (muscle.soreness > 0 && muscle.soreness > (sorest?.soreness ?? 0) ? muscle : sorest),
    null,
  )
}

interface SorenessBodyPickerProps {
  value: SorenessByMuscle
  onChange: (value: SorenessByMuscle) => void
  /** Muscles trained this week, tinted on the map as a hint of where to look. */
  trainedSlugs: readonly string[]
}

/**
 * Soreness by touch: tap a muscle on the body map to mark it sore (at
 * "moderate"), tap it again to clear it, and fine-tune each marked muscle's
 * level in the list below the map.
 */
export function SorenessBodyPicker({ value, onChange, trainedSlugs }: SorenessBodyPickerProps) {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const [side, setSide] = useState<BodySide>(() => preferredBodySide(trainedSlugs))
  const selected = Object.keys(value) as MuscleSlug[]
  const muscleName = (slug: string) => copy.muscleLabels[slug as keyof typeof copy.muscleLabels] ?? slug
  const levelLabel = (level: SorenessLevel) => copy.sorenessLevels.find((option) => option.value === level)?.label ?? ""

  const highlights: Partial<Record<MuscleSlug, string>> = {}
  for (const slug of trainedSlugs) highlights[slug as MuscleSlug] = TRAINED_FILL
  for (const slug of selected) {
    const level = value[slug]
    if (level) highlights[slug] = sorenessFill(level)
  }

  const toggle = (slug: MuscleSlug) => {
    const next = { ...value }
    if (next[slug]) delete next[slug]
    else next[slug] = DEFAULT_SORENESS_LEVEL
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-60">
        <SingleChoice<BodySide>
          ariaLabel={copy.sorenessBodyMapLabel}
          value={side}
          onChange={setSide}
          options={[
            { label: copy.bodyFront, value: "front" },
            { label: copy.bodyBack, value: "back" },
          ]}
        />
      </div>

      {/* Tall figure, capped so the marked list stays in view on a phone. */}
      <div className="mx-auto aspect-[1/2] h-[36svh] max-h-[340px] min-h-[220px]">
        <MuscleMap
          side={side}
          className="h-full w-full"
          highlights={highlights}
          onMuscleClick={toggle}
          selectedSlugs={new Set(selected)}
          getMuscleLabel={(slug) => {
            const level = value[slug]
            return copy.sorenessMuscleButton(muscleName(slug), level ? levelLabel(level) : null)
          }}
          label={copy.sorenessBodyMapLabel}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-micro text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: TRAINED_FILL }} />
          {copy.sorenessLegendTrained}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-6 rounded-sm"
            style={{ background: `linear-gradient(90deg, ${sorenessFill(2)}, ${sorenessFill(5)})` }}
          />
          {copy.sorenessLegendLevel}
        </span>
      </div>

      {selected.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{copy.sorenessNoneSelected}</p>
      ) : (
        <ul className="space-y-3">
          {selected.map((slug) => {
            const name = muscleName(slug)
            return (
              <li key={slug} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ background: sorenessFill(value[slug] ?? DEFAULT_SORENESS_LEVEL) }}
                    />
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(slug)}
                    aria-label={copy.removeSoreMuscle(name)}
                    className="-mr-2 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-11"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <SingleChoice<SorenessLevel>
                  ariaLabel={copy.sorenessLevelFor(name)}
                  value={value[slug] ?? DEFAULT_SORENESS_LEVEL}
                  onChange={(level) => onChange({ ...value, [slug]: level })}
                  options={copy.sorenessLevels.map((option) => ({
                    label: option.label,
                    value: option.value as SorenessLevel,
                  }))}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
