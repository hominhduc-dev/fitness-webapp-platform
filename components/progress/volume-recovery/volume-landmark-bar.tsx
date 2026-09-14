"use client"

import type { VolumeRecoveryMuscle, VolumeZone } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

type VolumeLandmarks = VolumeRecoveryMuscle["landmarks"]

/**
 * Zone colours follow the bands on the bar, so a chip and the marker under it
 * always agree. Below MEV is not a warning — it reads as "room to add", which
 * is why it takes the accent rather than a status colour.
 */
function volumeZoneClass(zone: VolumeZone) {
  if (zone === "mav" || zone === "mev_to_mav") return "bg-success-soft text-success-text"
  if (zone === "near_mrv") return "bg-warning-soft text-warning-text"
  if (zone === "above_mrv") return "bg-destructive-soft text-destructive-text"
  return "bg-primary-soft text-primary"
}

/**
 * A muscle's weekly hard sets placed against its own MEV/MAV/MRV landmarks.
 *
 * Bands, separators, marker and tick labels all read one scale, so the marker
 * always lands in the band that matches the zone reported for the same muscle.
 * The landmarks differ per trainee once a coach sets them or the profile is
 * learned, which is why nothing here is a fixed width.
 */
function VolumeLandmarkBar({
  className,
  landmarks,
  sets,
  showTicks = true,
}: {
  className?: string
  landmarks: VolumeLandmarks
  sets: number
  showTicks?: boolean
}) {
  const scaleMax = Math.max(landmarks.mrvSets * 1.15, sets * 1.05, 1)
  const toPercent = (value: number) => Math.min(100, Math.max(0, (value / scaleMax) * 100))
  const mevAt = toPercent(landmarks.mevSets)
  const mavMaxAt = toPercent(landmarks.mavMaxSets)
  const mrvAt = toPercent(landmarks.mrvSets)
  const position = toPercent(sets)

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative h-2" aria-hidden="true">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
          <span className="absolute inset-y-0 bg-success" style={{ left: `${mevAt}%`, width: `${mavMaxAt - mevAt}%` }} />
          <span className="absolute inset-y-0 bg-warning" style={{ left: `${mavMaxAt}%`, width: `${mrvAt - mavMaxAt}%` }} />
          <span className="absolute inset-y-0 right-0 bg-destructive" style={{ left: `${mrvAt}%` }} />
          {/* Surface-coloured separators so neighbouring bands stay countable. */}
          {[mevAt, mavMaxAt, mrvAt].map((at) => (
            <span key={at} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-card" style={{ left: `${at}%` }} />
          ))}
        </div>
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
          style={{ left: `${position}%` }}
        />
      </div>
      {showTicks ? (
        <div className="relative mt-2 h-4 font-mono text-micro tnum text-muted-foreground">
          {[
            { at: mevAt, label: `MEV ${landmarks.mevSets}` },
            { at: toPercent((landmarks.mavMinSets + landmarks.mavMaxSets) / 2), label: `MAV ${landmarks.mavMinSets}–${landmarks.mavMaxSets}` },
            { at: mrvAt, label: `MRV ${landmarks.mrvSets}` },
          ].map((tick) => (
            <span key={tick.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${tick.at}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { VolumeLandmarkBar, volumeZoneClass }
