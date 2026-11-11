import { describe, expect, it } from "vitest"

import { buildSetTargetMap } from "./set-target"

describe("buildSetTargetMap", () => {
  it("keys overrides by set number and keeps only the sets the exercise has", () => {
    const map = buildSetTargetMap(
      [
        { reps: 10, setNumber: 2 },
        { reps: 12, setNumber: 4 },
        { reps: 9, setNumber: 0 },
      ],
      3,
    )

    expect([...map.keys()]).toEqual([2])
  })

  it("lets a later override for the same set win", () => {
    const map = buildSetTargetMap([{ reps: 10, setNumber: 2 }, { reps: 6, setNumber: 2 }], 2)

    expect(map.get(2)?.reps).toBe(6)
  })

  it("is empty without overrides", () => {
    expect(buildSetTargetMap(undefined, 3).size).toBe(0)
  })
})
