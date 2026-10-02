/**
 * Pure shaping for the progress Overview tab: turns the analytics the page
 * already loads into what each block draws. No React, no fetching.
 */

type YearViewDay = { count: number; date: string; volume: number }

type ConsistencyCell = {
  count: number
  date: string
  /** 0 = rest, 1–4 = volume quartile of the training days in the window. */
  level: 0 | 1 | 2 | 3 | 4
  isFuture: boolean
  volume: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Monday of the local week containing `date`. */
function startOfLocalWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  return start
}

/**
 * The last `weeks` weeks as Monday-first columns of seven days. Training days
 * are shaded by volume quartile within the window, so the scale adapts to the
 * trainee instead of a fixed kg threshold nobody reaches or everybody passes.
 */
function buildConsistencyGrid(days: readonly YearViewDay[], today: Date, weeks = 12) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const firstMonday = startOfLocalWeek(today)
  firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7)
  const todayKey = dateKey(today)

  const cells: ConsistencyCell[] = []
  for (let index = 0; index < weeks * 7; index += 1) {
    const date = new Date(firstMonday)
    date.setDate(firstMonday.getDate() + index)
    const key = dateKey(date)
    const day = byDate.get(key)
    cells.push({
      count: day?.count ?? 0,
      date: key,
      isFuture: key > todayKey,
      level: 0,
      volume: day?.volume ?? 0,
    })
  }

  const volumes = cells.filter((cell) => cell.count > 0).map((cell) => cell.volume).sort((a, b) => a - b)
  // The value at or below which `fraction` of the training days fall.
  const quartile = (fraction: number) => volumes[Math.max(0, Math.ceil(fraction * volumes.length) - 1)] ?? 0
  const cuts = [quartile(0.25), quartile(0.5), quartile(0.75)]
  for (const cell of cells) {
    if (cell.count === 0) continue
    cell.level = cell.volume <= cuts[0] ? 1 : cell.volume <= cuts[1] ? 2 : cell.volume <= cuts[2] ? 3 : 4
  }

  const columns = Array.from({ length: weeks }, (_, week) => cells.slice(week * 7, week * 7 + 7))
  const trainedWeeks = columns.map((column) => column.some((cell) => cell.count > 0))
  // Consecutive trained weeks ending this week, or last week while this one is still empty.
  let weekStreak = 0
  for (let week = weeks - 1; week >= 0; week -= 1) {
    if (trainedWeeks[week]) weekStreak += 1
    else if (week === weeks - 1) continue
    else break
  }

  return {
    activeDays: cells.filter((cell) => cell.count > 0).length,
    columns,
    weekStreak,
  }
}

type VolumeZone = "above_mrv" | "below_mev" | "insufficient_data" | "mav" | "mev_to_mav" | "near_mrv"

/** Zone → fill on the body map. Status-like, so it always ships with a text legend. */
const ZONE_FILL: Record<VolumeZone, string> = {
  above_mrv: "var(--destructive)",
  below_mev: "color-mix(in oklab, var(--muted-foreground) 35%, var(--body-fill))",
  insufficient_data: "var(--body-fill)",
  mav: "var(--success)",
  mev_to_mav: "color-mix(in oklab, var(--success) 50%, var(--body-fill))",
  near_mrv: "var(--warning)",
}

const ZONE_ORDER: readonly VolumeZone[] = ["below_mev", "mev_to_mav", "mav", "near_mrv", "above_mrv"]

function muscleZoneHighlights(muscles: ReadonlyArray<{ muscleSlug: string; zone: VolumeZone }>) {
  return Object.fromEntries(muscles.map((muscle) => [muscle.muscleSlug, ZONE_FILL[muscle.zone]]))
}

type StrengthProgress = {
  points: Array<{ label: string; values: Record<string, number | null> }>
  series: Array<{ exerciseName: string; key: string }>
}

type StrengthCard = {
  changePct: number | null
  current: number | null
  exerciseName: string
  hasRecentPR: boolean
  key: string
  values: number[]
}

/** The tracked lifts with their e1RM series, change over the period and whether a PR landed. */
function buildStrengthCards(progress: StrengthProgress, recentPRNames: readonly string[], limit = 3): StrengthCard[] {
  const prNames = new Set(recentPRNames)
  return progress.series.slice(0, limit).map((series) => {
    const values = progress.points.flatMap((point) => {
      const value = point.values[series.key]
      return typeof value === "number" && Number.isFinite(value) ? [value] : []
    })
    const first = values[0]
    const last = values.at(-1)
    return {
      changePct: first && last && values.length > 1 ? Math.round(((last - first) / first) * 1000) / 10 : null,
      current: last ?? null,
      exerciseName: series.exerciseName,
      hasRecentPR: prNames.has(series.exerciseName),
      key: series.key,
      values,
    }
  })
}

/**
 * An SVG path through `values`, scaled into a `width`×`height` box with a
 * little vertical padding. Flat series sit mid-height rather than on an edge.
 */
function sparklinePath(values: readonly number[], width: number, height: number, padding = 2) {
  if (values.length === 0) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const y = (value: number) =>
    span === 0 ? height / 2 : padding + (1 - (value - min) / span) * (height - padding * 2)
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${y(value).toFixed(1)}`)
    .join(" ")
}

/** Percent change from the first to the last point, or null without two non-zero points. */
function seriesChangePct(values: readonly number[]) {
  const first = values.find((value) => value > 0)
  const last = values.at(-1)
  if (!first || last == null || values.length < 2) return null
  return Math.round(((last - first) / first) * 100)
}

/** A trailing seven-day mean for each reading, one reading per day. */
function rollingAverage(points: ReadonlyArray<{ date: Date; value: number }>, windowDays = 7) {
  return points.map((point) => {
    const from = point.date.getTime() - (windowDays - 1) * DAY_MS
    const window = points.filter((other) => other.date.getTime() >= from && other.date.getTime() <= point.date.getTime())
    const mean = window.reduce((sum, other) => sum + other.value, 0) / window.length
    return { ...point, average: Math.round(mean * 10) / 10 }
  })
}

type InsightFacts = {
  musclesToAdjust: number
  plannedThisWeek: number
  sessionsThisWeek: number
  strongestLift: { changePct: number; name: string } | null
  weightRatePerWeekKg: number | null
}

/** The facts the one-line insight is written from, picked so it says something worth reading. */
function buildInsightFacts(input: {
  muscles: ReadonlyArray<{ recommendation: { action: string; status?: string } }>
  plannedThisWeek: number
  sessionsThisWeek: number
  strength: readonly StrengthCard[]
  weightRatePerWeekKg: number | null
}): InsightFacts {
  const best = input.strength
    .filter((card): card is StrengthCard & { changePct: number } => card.changePct != null && card.changePct > 0)
    .sort((left, right) => right.changePct - left.changePct)[0]
  return {
    musclesToAdjust: input.muscles.filter(
      (muscle) => muscle.recommendation.action !== "maintain" && muscle.recommendation.status !== "dismissed",
    ).length,
    plannedThisWeek: input.plannedThisWeek,
    sessionsThisWeek: input.sessionsThisWeek,
    strongestLift: best ? { changePct: best.changePct, name: best.exerciseName } : null,
    weightRatePerWeekKg: input.weightRatePerWeekKg,
  }
}

export {
  buildConsistencyGrid,
  buildInsightFacts,
  buildStrengthCards,
  muscleZoneHighlights,
  rollingAverage,
  seriesChangePct,
  sparklinePath,
  ZONE_FILL,
  ZONE_ORDER,
}
export type { ConsistencyCell, InsightFacts, StrengthCard, VolumeZone }
