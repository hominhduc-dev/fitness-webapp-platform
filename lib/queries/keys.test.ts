import { describe, expect, it } from "vitest"

import { queryKeys } from "./keys"

describe("query keys", () => {
  it("separates a summary-only calendar from the full one", () => {
    // Same month, different payload shape: the summary response carries no
    // per-day log stubs. Sharing a key would serve the summary to the grid.
    expect(queryKeys.progress.calendar(2026, 3, { summaryOnly: true })).not.toEqual(
      queryKeys.progress.calendar(2026, 3),
    )
  })

  it("treats exercise filters that build the same request as one entry", () => {
    expect(queryKeys.exercises.list({ search: "bench " })).toEqual(
      queryKeys.exercises.list({ search: "bench" }),
    )
    expect(queryKeys.exercises.list({ search: "   " })).toEqual(queryKeys.exercises.list())
    expect(queryKeys.exercises.list({ equipment: " barbell " })).toEqual(
      queryKeys.exercises.list({ equipment: "barbell" }),
    )
  })

  it("keeps the exercise list and library in separate entries", () => {
    expect(queryKeys.exercises.list()).not.toEqual(queryKeys.exercises.library())
  })

  it("folds the food category sentinel into no filter", () => {
    expect(queryKeys.meals.foods({ category: "all" })).toEqual(queryKeys.meals.foods())
  })

  it("prefixes every key with its domain so coarse invalidation reaches it", () => {
    // invalidateQueries({ queryKey: domain.all }) matches by key prefix, so this
    // is what makes the invalidation map in the plan actually work.
    const cases: Array<[readonly unknown[], readonly unknown[]]> = [
      [queryKeys.coach.all, queryKeys.coach.program("p1")],
      [queryKeys.coach.all, queryKeys.coach.workoutLogs("t1", { weekStart: "2026-09-07" })],
      [queryKeys.progress.all, queryKeys.progress.calendar(2026, 3)],
      [queryKeys.progress.all, queryKeys.progress.weightEntries(30)],
      [queryKeys.workouts.all, queryKeys.workouts.detail("w1")],
      [queryKeys.exercises.all, queryKeys.exercises.library()],
      [queryKeys.meals.all, queryKeys.meals.nutritionDay("2026-09-12")],
      [queryKeys.admin.all, queryKeys.admin.userDetail("u1")],
    ]

    for (const [prefix, key] of cases) {
      expect(key.slice(0, prefix.length)).toEqual(prefix)
    }
  })

  it("normalizes the two ways of asking for weight entries", () => {
    expect(queryKeys.progress.weightEntries(30)).toEqual(
      queryKeys.progress.weightEntries({ days: 30 }),
    )
  })
})
