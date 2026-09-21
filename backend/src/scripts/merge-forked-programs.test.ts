import { describe, expect, it } from "vitest"

import { planCopyAction } from "./merge-forked-programs"

/**
 * The script deletes programs, so the decision it makes per copy is pinned
 * here. The property that matters: nothing holding workout logs is ever
 * deleted, and nothing is merged unless there is a live program to merge into.
 */
const plan = (overrides: Partial<Parameters<typeof planCopyAction>[0]> = {}) =>
  planCopyAction({
    assignmentCount: 1,
    isOwnRoot: false,
    logCount: 0,
    rootExists: true,
    ...overrides,
  })

describe("what to do with a personalized copy", () => {
  it("merges a single-trainee copy whose original is still there", () => {
    expect(plan()).toEqual({ kind: "merge" })
  })

  /**
   * The coach deleted the original after the copy split off — nothing stops
   * them, since forkedFromProgramId carries no foreign key. The copy is now the
   * only program holding this trainee's plan and every log written against it,
   * so it is kept and promoted rather than merged into nothing.
   */
  it("promotes a copy whose original has been deleted, however many logs it holds", () => {
    expect(plan({ rootExists: false })).toEqual({
      kind: "promote",
      reason: "the original no longer exists",
    })
    expect(plan({ logCount: 240, rootExists: false })).toMatchObject({ kind: "promote" })
  })

  it("promotes a copy whose fork pointer resolves to itself", () => {
    expect(plan({ isOwnRoot: true })).toEqual({
      kind: "promote",
      reason: "fork pointer resolves to itself",
    })
  })

  it("deletes an unassigned copy only when it carries no history", () => {
    expect(plan({ assignmentCount: 0 })).toEqual({ kind: "deleteOrphan" })
  })

  /** The one rule worth the whole file: history outranks tidiness. */
  it("never deletes an unassigned copy that still holds logs", () => {
    expect(plan({ assignmentCount: 0, logCount: 1 })).toEqual({
      kind: "skip",
      reason: "unassigned but holds 1 logs",
    })
  })

  it("leaves a copy shared by several trainees alone", () => {
    expect(plan({ assignmentCount: 2 })).toMatchObject({ kind: "skip" })
  })

  it("never plans a destructive action while logs are at risk", () => {
    const destructive = new Set(["deleteOrphan", "merge"])

    for (const assignmentCount of [0, 1, 2]) {
      for (const isOwnRoot of [false, true]) {
        for (const rootExists of [false, true]) {
          const result = plan({ assignmentCount, isOwnRoot, logCount: 12, rootExists })
          if (!destructive.has(result.kind)) continue

          // Reaching merge with logs is fine — the merge remaps them first —
          // but only ever with a real root to remap them onto.
          expect(result.kind).toBe("merge")
          expect(rootExists && !isOwnRoot && assignmentCount === 1).toBe(true)
        }
      }
    }
  })
})
