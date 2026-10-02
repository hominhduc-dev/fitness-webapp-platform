"use client"

import { useMemo, useState } from "react"

import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import type { MuscleSlug } from "@/components/body/muscle-map"
import { useLocale } from "@/components/providers/locale-provider"
import { muscleZoneHighlights, ZONE_FILL, ZONE_ORDER, type VolumeZone } from "@/lib/fitness/progress-overview"
import type { VolumeRecoveryMuscle } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

/** Where effective sets sit along MEV → MRV, as a 0–100 position on the bar. */
function position(sets: number, mrv: number) {
  const end = Math.max(mrv * 1.15, sets, 1)
  return Math.min(100, (sets / end) * 100)
}

/**
 * The week's volume on the body: each trained muscle filled by its landmark
 * zone. The legend names every zone, and choosing a muscle (on the figure or
 * in the list) shows its sets against MEV, MAV and MRV.
 */
export function MuscleZoneCard({ muscles }: { muscles: VolumeRecoveryMuscle[] }) {
  const { messages } = useLocale()
  const copy = messages.progressPage.overview.zones
  const labels = messages.volumeRecovery.muscleLabels
  const labelOf = (slug: string) => labels[slug as keyof typeof labels] ?? slug
  const trained = useMemo(
    () => muscles.filter((muscle) => muscle.effectiveSets > 0).sort((a, b) => b.effectiveSets - a.effectiveSets),
    [muscles],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const active = trained.find((muscle) => muscle.muscleSlug === selected) ?? trained[0] ?? null
  const highlights = useMemo(() => muscleZoneHighlights(trained), [trained]) as Partial<Record<MuscleSlug, string>>

  if (trained.length === 0) return <p className="py-6 text-sm text-muted-foreground">{copy.empty}</p>

  const { mavMaxSets, mavMinSets, mevSets, mrvSets } = active?.landmarks ?? { mavMaxSets: 0, mavMinSets: 0, mevSets: 0, mrvSets: 0 }
  const end = Math.max(mrvSets * 1.15, active?.effectiveSets ?? 0, 1)
  const pct = (sets: number) => `${Math.min(100, (sets / end) * 100)}%`

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <MuscleMapPair
          highlights={highlights}
          label={copy.title}
          onMuscleClick={(slug) => setSelected(slug)}
        />
        <ul className="w-full min-w-0 flex-1 space-y-1" aria-label={copy.title}>
          {trained.slice(0, 6).map((muscle) => (
            <li key={muscle.muscleSlug}>
              <button
                type="button"
                onClick={() => setSelected(muscle.muscleSlug)}
                aria-pressed={active?.muscleSlug === muscle.muscleSlug}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted pointer-coarse:min-h-11",
                  active?.muscleSlug === muscle.muscleSlug && "bg-muted",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: ZONE_FILL[muscle.zone as VolumeZone] }} aria-hidden="true" />
                {/* Name over zone, so neither is cut short in a half-width card. */}
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-foreground">{labelOf(muscle.muscleSlug)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{copy.legend[muscle.zone as Exclude<VolumeZone, "insufficient_data">] ?? ""}</span>
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-xs tnum text-foreground">{muscle.effectiveSets}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active ? (
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{labelOf(active.muscleSlug)}</p>
            <p className="text-xs text-muted-foreground">{copy.sets(active.effectiveSets)}</p>
          </div>
          {/* MEV → MAV → MRV as one track: the productive band is shaded, the marker is this week. */}
          <div className="relative mt-2 h-2 rounded-full bg-border" aria-hidden="true">
            <div className="absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--success)_35%,transparent)]" style={{ left: pct(mavMinSets), right: `calc(100% - ${pct(mavMaxSets)})` }} />
            <div className="absolute inset-y-[-3px] w-px bg-muted-foreground/60" style={{ left: pct(mevSets) }} />
            <div className="absolute inset-y-[-3px] w-px bg-destructive" style={{ left: pct(mrvSets) }} />
            <div
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
              style={{ background: ZONE_FILL[active.zone as VolumeZone], left: `${position(active.effectiveSets, mrvSets)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] tnum text-muted-foreground">{copy.landmarks(mevSets, mavMinSets, mavMaxSets, mrvSets)}</p>
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {ZONE_ORDER.map((zone) => (
          <li key={zone} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: ZONE_FILL[zone] }} aria-hidden="true" />
            {copy.legend[zone as Exclude<VolumeZone, "insufficient_data">]}
          </li>
        ))}
      </ul>
    </div>
  )
}
