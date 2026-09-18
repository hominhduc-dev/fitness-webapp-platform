/**
 * Shape and formatting of the shareable stats card.
 *
 * Everything here is pure: no DOM, no React, no messages import. The caller
 * passes already-localised copy so the same builder serves the progress page,
 * a finished workout and anything else that wants a card later.
 */

export type ShareCardFormatId = "square" | "story"

export type ShareCardFormat = {
  /** Exported pixel height. */
  height: number
  id: ShareCardFormatId
  /** Exported pixel width. */
  width: number
}

/**
 * Square covers feed posts on Facebook and Zalo; story covers the 9:16 slot on
 * Instagram and Facebook stories. Both export at 1080px wide, the width every
 * one of those apps re-encodes to anyway.
 */
export const SHARE_CARD_FORMATS: Record<ShareCardFormatId, ShareCardFormat> = {
  square: { height: 1080, id: "square", width: 1080 },
  story: { height: 1920, id: "story", width: 1080 },
}

export const SHARE_CARD_FORMAT_IDS: ShareCardFormatId[] = ["square", "story"]

export type ShareCardStat = {
  /** Small caption under the figure — a delta, a target, a comparison. */
  detail?: string
  label: string
  unit?: string
  value: string
}

export type ShareCardData = {
  /** Who trained. Falls back to a generic label when the profile has no name. */
  athleteName: string
  headline: {
    caption: string
    /** The movement behind the figure — a delta, not a second name for it. */
    trend: string
    unit?: string
    value: string
  }
  /** Optional hero line — a new personal record reads better than a fifth tile. */
  highlight?: { label: string; value: string }
  periodLabel: string
  /** Four tiles fill both formats without wrapping; extras are dropped. */
  stats: ShareCardStat[]
  stamp: string
}

export const SHARE_CARD_STAT_LIMIT = 4

export type ShareCardCopy = {
  anonymousAthlete: string
  avgDuration: string
  headlineCaption: string
  newRecords: string
  strength: string
  vsPrevious: string
  workouts: string
}

export type ProgressShareSummary = {
  avgDurationMins: number
  completedWorkouts: number
  e1rmChangePct: number
  latestPR: { deltaKg: number; exerciseName: string } | null
  newPRsCount: number
  plannedWorkouts: number
  totalVolume: number
  volumeDeltaPct: number
}

/** Thousands separators make a six-digit volume readable at a glance. */
function formatCount(value: number, localeCode: string) {
  return new Intl.NumberFormat(localeCode, { maximumFractionDigits: 0 }).format(Math.round(value))
}

/**
 * Volume runs from a few hundred to hundreds of thousands of kg. Past 10k the
 * exact figure stops carrying meaning and starts costing headline width, so it
 * is compacted to one decimal.
 */
export function formatShareVolume(value: number, localeCode: string) {
  if (value >= 10_000) {
    const thousands = new Intl.NumberFormat(localeCode, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
    return `${thousands.format(value / 1000)}k`
  }
  return formatCount(value, localeCode)
}

/** `72` → `1h 12m`; a bare minute count past an hour stops being readable. */
export function formatDurationLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe}m`
  return `${Math.floor(safe / 60)}h ${safe % 60}m`
}

export function formatSignedPercent(value: number, localeCode: string) {
  const rounded = Number(value.toFixed(1))
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${new Intl.NumberFormat(localeCode, { maximumFractionDigits: 1 }).format(rounded)}%`
}

/**
 * Turns the progress period summary into the card's four tiles plus a headline.
 * Volume is the headline because it is the one figure that grows with every
 * session — a card whose hero number is "0 records" is not worth posting.
 */
export function buildProgressShareCard({
  athleteName,
  copy,
  localeCode,
  periodLabel,
  stamp,
  summary,
  weightUnit,
}: {
  athleteName: string | null | undefined
  copy: ShareCardCopy
  localeCode: string
  periodLabel: string
  stamp: string
  summary: ProgressShareSummary
  weightUnit: string
}): ShareCardData {
  const stats: ShareCardStat[] = [
    {
      detail: `/ ${formatCount(summary.plannedWorkouts, localeCode)}`,
      label: copy.workouts,
      value: formatCount(summary.completedWorkouts, localeCode),
    },
    {
      detail: copy.vsPrevious,
      label: copy.strength,
      value: formatSignedPercent(summary.e1rmChangePct, localeCode),
    },
    {
      // No detail: the personal record this count refers to already gets the
      // accent strip above, and repeating its name here reads as a stutter.
      label: copy.newRecords,
      value: formatCount(summary.newPRsCount, localeCode),
    },
    {
      label: copy.avgDuration,
      value: formatDurationLabel(summary.avgDurationMins),
    },
  ]

  return {
    athleteName: athleteName?.trim() || copy.anonymousAthlete,
    headline: {
      caption: copy.headlineCaption,
      // Total volume is the hero figure, so it never repeats as a tile.
      trend: `${formatSignedPercent(summary.volumeDeltaPct, localeCode)} ${copy.vsPrevious}`,
      unit: weightUnit,
      value: formatShareVolume(summary.totalVolume, localeCode),
    },
    highlight: summary.latestPR
      ? {
          label: summary.latestPR.exerciseName,
          value: `+${new Intl.NumberFormat(localeCode, { maximumFractionDigits: 1 }).format(summary.latestPR.deltaKg)} ${weightUnit}`,
        }
      : undefined,
    periodLabel,
    stats: stats.slice(0, SHARE_CARD_STAT_LIMIT),
    stamp,
  }
}

/** `yeahbuddy-progress-2026-09-18-story.png` — sorts by date in a photo roll. */
export function buildShareFileName(prefix: string, format: ShareCardFormatId, date: Date) {
  const iso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
  return `${prefix}-${iso}-${format}.png`
}
