import { describe, expect, it } from "vitest"

import { shortWeekday } from "./weekday"

// 21 Sep 2026 is a Monday.
const day = (offset: number) => new Date(2026, 8, 21 + offset)

describe("shortWeekday", () => {
  it("uses T2…T7 and CN in Vietnamese", () => {
    expect(Array.from({ length: 7 }, (_, index) => shortWeekday(day(index), "vi-VN"))).toEqual([
      "T2", "T3", "T4", "T5", "T6", "T7", "CN",
    ])
  })

  it("keeps the platform short weekday elsewhere", () => {
    expect(shortWeekday(day(0), "en-US")).toBe("Mon")
  })
})
