import { describe, expect, it } from "vitest"

import {
  buildProgressShareCard,
  buildShareFileName,
  buildWorkoutShareCard,
  formatDurationLabel,
  formatShareVolume,
  formatSignedPercent,
  SHARE_CARD_STAT_LIMIT,
  type ProgressShareSummary,
  type ShareCardCopy,
} from "@/lib/share/stats-card"

const copy: ShareCardCopy = {
  anonymousAthlete: "Athlete",
  avgDuration: "Avg duration",
  headlineCaption: "Training volume moved",
  newRecords: "New records",
  strength: "Strength",
  vsPrevious: "vs previous",
  workouts: "Workouts",
}

const summary: ProgressShareSummary = {
  avgDurationMins: 72,
  completedWorkouts: 21,
  e1rmChangePct: 4.25,
  latestPR: { deltaKg: 5, exerciseName: "Bench Press" },
  newPRsCount: 3,
  plannedWorkouts: 24,
  totalVolume: 128_450,
  volumeDeltaPct: 12.34,
}

function build(overrides: Partial<Parameters<typeof buildProgressShareCard>[0]> = {}) {
  return buildProgressShareCard({
    athleteName: "Đức Hồ",
    copy,
    localeCode: "en-US",
    periodLabel: "Last 90 days",
    stamp: "18 Sep 2026",
    summary,
    weightUnit: "kg",
    ...overrides,
  })
}

describe("formatShareVolume", () => {
  it("prints figures under ten thousand in full", () => {
    expect(formatShareVolume(9_999, "en-US")).toBe("9,999")
  })

  it("compacts larger figures to one decimal", () => {
    expect(formatShareVolume(128_450, "en-US")).toBe("128.5k")
  })

  it("switches on ten thousand exactly", () => {
    expect(formatShareVolume(10_000, "en-US")).toBe("10.0k")
  })
})

describe("formatDurationLabel", () => {
  it("keeps a sub-hour session in minutes", () => {
    expect(formatDurationLabel(48)).toBe("48m")
  })

  it("splits an hour or more", () => {
    expect(formatDurationLabel(72)).toBe("1h 12m")
  })

  it("never prints a negative duration", () => {
    expect(formatDurationLabel(-5)).toBe("0m")
  })
})

describe("formatSignedPercent", () => {
  it("marks a gain with a plus so the direction survives without colour", () => {
    expect(formatSignedPercent(12.34, "en-US")).toBe("+12.3%")
  })

  it("keeps the minus a loss already carries", () => {
    expect(formatSignedPercent(-3.1, "en-US")).toBe("-3.1%")
  })

  it("leaves a flat period unsigned", () => {
    expect(formatSignedPercent(0, "en-US")).toBe("0%")
  })
})

describe("buildProgressShareCard", () => {
  it("leads with training volume", () => {
    const card = build()
    expect(card.headline.value).toBe("128.5k")
    expect(card.headline.unit).toBe("kg")
  })

  it("puts the volume trend under the headline instead of repeating the figure as a tile", () => {
    const card = build()
    expect(card.headline.trend).toBe("+12.3% vs previous")
    expect(card.stats.map((stat) => stat.label)).toEqual([
      "Workouts",
      "Strength",
      "New records",
      "Avg duration",
    ])
  })

  it("fills exactly the tiles the layout has room for", () => {
    expect(build().stats).toHaveLength(SHARE_CARD_STAT_LIMIT)
  })

  it("shows completed workouts against the plan", () => {
    const [workouts] = build().stats
    expect(workouts.value).toBe("21")
    expect(workouts.detail).toBe("/ 24")
  })

  it("promotes the latest personal record to the accent strip", () => {
    expect(build().highlight).toEqual({ label: "Bench Press", value: "+5 kg" })
  })

  it("drops the strip when the period set no record", () => {
    expect(build({ summary: { ...summary, latestPR: null } }).highlight).toBeUndefined()
  })

  it("falls back to a neutral name rather than posting an empty byline", () => {
    expect(build({ athleteName: "   " }).athleteName).toBe("Athlete")
    expect(build({ athleteName: null }).athleteName).toBe("Athlete")
  })

  it("keeps the trainee's own name when there is one", () => {
    expect(build().athleteName).toBe("Đức Hồ")
  })

  it("carries the weight unit the trainee reads in", () => {
    const card = build({ weightUnit: "lbs" })
    expect(card.headline.unit).toBe("lbs")
    expect(card.highlight?.value).toBe("+5 lbs")
  })
})

describe("buildShareFileName", () => {
  it("names the file by local date and format so a photo roll sorts it", () => {
    expect(buildShareFileName("yeahbuddy-progress", "story", new Date(2026, 8, 18))).toBe(
      "yeahbuddy-progress-2026-09-18-story.png",
    )
  })

  it("pads single-digit months and days", () => {
    expect(buildShareFileName("yeahbuddy", "square", new Date(2026, 0, 5))).toBe("yeahbuddy-2026-01-05-square.png")
  })
})

describe("buildWorkoutShareCard", () => {
  const workoutCopy = {
    anonymousAthlete: "Athlete",
    duration: "Duration",
    exercises: "Exercises",
    headlineCaption: "Volume lifted",
    reps: "Reps",
    sets: "Sets",
  }
  const workoutSummary = {
    completedExercises: 6,
    completedSets: 14,
    durationMins: 62,
    topSet: { exerciseName: "Leg Press", reps: 10, weight: 240 },
    totalExercises: 7,
    totalReps: 152,
    totalSets: 16,
    totalVolume: 12_840,
    workoutName: "Day 3",
  }

  it("leads with the session's volume under its name", () => {
    const card = buildWorkoutShareCard({
      athleteName: "Minh Duc",
      copy: workoutCopy,
      localeCode: "en-US",
      stamp: "Sep 30, 2026",
      summary: workoutSummary,
      weightUnit: "kg",
    })

    expect(card.periodLabel).toBe("Day 3")
    expect(card.headline).toMatchObject({ trend: "14 sets · 152 reps", unit: "kg", value: "12.8k" })
    expect(card.highlight).toEqual({ label: "Leg Press", value: "240 kg × 10" })
    expect(card.stats.map((stat) => [stat.label, stat.value, stat.detail])).toEqual([
      ["Duration", "1h 2m", undefined],
      ["Sets", "14", "/ 16"],
      ["Exercises", "6", "/ 7"],
      ["Reps", "152", undefined],
    ])
  })

  it("drops the accent strip when no set carried weight", () => {
    const card = buildWorkoutShareCard({
      athleteName: "",
      copy: workoutCopy,
      localeCode: "en-US",
      stamp: "Sep 30, 2026",
      summary: { ...workoutSummary, topSet: null },
      weightUnit: "kg",
    })

    expect(card.highlight).toBeUndefined()
    expect(card.athleteName).toBe("Athlete")
  })
})
