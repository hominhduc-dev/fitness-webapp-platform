import { describe, expect, it } from "vitest"
import { dayKey, localDateKey, startOfVietnamDay, validDateKey } from "./calendar"
import { generateMealPlanSchema, chatSchema, generateProgramSchema } from "../../routes/ai.schemas"
import { dailyOutputSchema, parseAI } from "./output-schemas"

describe("AI date and payload boundaries", () => {
  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-1-01", "not-a-date"])("rejects impossible date %s", value => {
    expect(validDateKey(value)).toBe(false)
    expect(generateMealPlanSchema.safeParse({ date: value }).success).toBe(false)
  })
  it("accepts a real leap day", () => { expect(validDateKey("2028-02-29")).toBe(true) })
  it("distinguishes date-only keys from timestamp boundaries at Vietnamese midnight", () => {
    const before = new Date("2026-09-10T16:59:59.999Z")
    const after = new Date("2026-09-10T17:00:00.000Z")
    expect(localDateKey(before)).toBe("2026-09-10")
    expect(localDateKey(after)).toBe("2026-09-11")
    expect(dayKey(after).toISOString()).toBe("2026-09-11T00:00:00.000Z")
    expect(startOfVietnamDay(after).toISOString()).toBe("2026-09-10T17:00:00.000Z")
  })
  it("rejects oversized history entries and non-array history", () => {
    expect(chatSchema.safeParse({ message: "hi", history: [{ role: "user", content: "x".repeat(4001) }] }).success).toBe(false)
    expect(chatSchema.safeParse({ message: "hi", history: "wrong" }).success).toBe(false)
  })
  it("rejects wrong enums and boolean/empty numeric values", () => {
    const input = { availableEquipment: "bodyweight", goal: "strength", experienceLevel: "beginner", daysPerWeek: 2, durationWeeks: 1, sessionDuration: 30 }
    for (const patch of [{ goal: "invented" }, { experienceLevel: "expert" }, { daysPerWeek: true }, { daysPerWeek: "" }, { durationWeeks: 17 }]) {
      expect(generateProgramSchema.safeParse({ ...input, ...patch }).success).toBe(false)
    }
  })
  it("rejects malformed daily metadata and numeric overflow", () => {
    const data = { name: "Workout", description: "", kind: "full_body", duration: 30, warmup: "", exercises: [{ variationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", sets: 3, reps: 10 }] }
    for (const patch of [{ kind: "invented" }, { duration: -1 }, { name: "" }, { exercises: Array(21).fill(data.exercises[0]) }, { exercises: [{ ...data.exercises[0], restTime: Infinity }] }]) {
      expect(() => parseAI(dailyOutputSchema, { ...data, ...patch })).toThrow(expect.objectContaining({ status: 422 }))
    }
  })
})
