import { describe, expect, it } from "vitest"

import { buildBackOffSetTargets, readBackOffTarget, readSetTargets } from "@/lib/workout/per-set-target"

const topBackOff = (sets: number) =>
  Array.from({ length: sets }, (_value, index) => ({ setNumber: index + 1, tag: index === 0 ? ("top_set" as const) : ("back_off" as const) }))

const top = { rir: 1, setNumber: 1, targetReps: 8, targetRepsMin: 6, weight: 65 }
const backOff = (setNumber: number) => ({ rir: 2, setNumber, targetReps: 10, targetRepsMin: 5, weight: 50 })

describe("readBackOffTarget", () => {
  it("reads the back-off sets of a top set + back-off exercise as text fields", () => {
    expect(readBackOffTarget([top, backOff(2), backOff(3)], topBackOff(3))).toEqual({ reps: "5-10", rir: "2", weight: "50" })
  })

  it("is undefined when the back-off sets match the top set or the scheme is off", () => {
    expect(readBackOffTarget([top, { ...top, setNumber: 2 }], topBackOff(2))).toBeUndefined()
    expect(readBackOffTarget([top, backOff(2)], [])).toBeUndefined()
  })

  it("orders the sets by number first", () => {
    expect(readBackOffTarget([backOff(2), top], topBackOff(2))).toEqual({ reps: "5-10", rir: "2", weight: "50" })
  })
})

describe("buildBackOffSetTargets", () => {
  it("sends one override per set after the top set", () => {
    expect(buildBackOffSetTargets({ reps: "5-10", rir: "2", weight: "50" }, 3, topBackOff(3))).toEqual({
      setTargets: [
        { repsMin: 5, reps: 10, rir: 2, setNumber: 2, weight: 50 },
        { repsMin: 5, reps: 10, rir: 2, setNumber: 3, weight: 50 },
      ],
    })
  })

  it("leaves a blank weight or RIR out so the set keeps the exercise's", () => {
    expect(buildBackOffSetTargets({ reps: "12", rir: "", weight: "" }, 2, topBackOff(2))).toEqual({
      setTargets: [{ reps: 12, setNumber: 2 }],
    })
  })

  it("sends nothing without the scheme or a back-off row", () => {
    expect(buildBackOffSetTargets({ reps: "5-10", rir: "", weight: "50" }, 3, [])).toEqual({ setTargets: undefined })
    expect(buildBackOffSetTargets(undefined, 3, topBackOff(3))).toEqual({ setTargets: undefined })
  })

  it("reports unreadable back-off reps", () => {
    expect(buildBackOffSetTargets({ reps: "lots", rir: "", weight: "" }, 2, topBackOff(2))).toEqual({ error: "reps" })
  })
})

describe("readSetTargets", () => {
  it("lists only the sets that differ from set 1", () => {
    expect(readSetTargets([top, { ...top, setNumber: 2 }, backOff(3)])).toEqual([
      { reps: 10, repsMin: 5, rir: 2, setNumber: 3, weight: 50 },
    ])
    expect(readSetTargets([top, { ...top, setNumber: 2 }])).toBeUndefined()
  })
})
