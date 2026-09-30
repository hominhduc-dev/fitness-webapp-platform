import { describe, expect, it } from "vitest"

import { moveListItem } from "@/components/workout/sortable-exercise-list"

describe("moveListItem", () => {
  it("moves an item down into the target's place", () => {
    expect(moveListItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
  })

  it("moves an item up into the target's place", () => {
    expect(moveListItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
  })

  it("leaves the list alone for equal or out-of-range indexes", () => {
    const list = ["a", "b"]
    expect(moveListItem(list, 1, 1)).toBe(list)
    expect(moveListItem(list, -1, 0)).toBe(list)
    expect(moveListItem(list, 0, 5)).toBe(list)
  })
})
