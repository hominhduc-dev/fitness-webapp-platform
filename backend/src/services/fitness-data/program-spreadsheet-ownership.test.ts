import { describe, expect, it, vi } from "vitest"

import { assertGoogleSpreadsheetNotInUse } from "./core"

function fakeDb(program: { createdById: string; name: string } | null) {
  return { program: { findFirst: vi.fn().mockResolvedValue(program) } } as unknown as Parameters<
    typeof assertGoogleSpreadsheetNotInUse
  >[0]
}

describe("assertGoogleSpreadsheetNotInUse", () => {
  it("does nothing when no spreadsheet is linked", async () => {
    const db = fakeDb(null)
    await expect(assertGoogleSpreadsheetNotInUse(db, "coach-a", undefined)).resolves.toBeUndefined()
    expect(db.program.findFirst).not.toHaveBeenCalled()
  })

  it("allows a spreadsheet no program has claimed yet", async () => {
    const db = fakeDb(null)
    await expect(assertGoogleSpreadsheetNotInUse(db, "coach-a", "sheet-1")).resolves.toBeUndefined()
    // Every program, not just other coaches': importing the same sheet twice is
    // what put two programs on one spreadsheet in the first place.
    expect(db.program.findFirst).toHaveBeenCalledWith({
      select: { createdById: true, name: true },
      where: { googleSpreadsheetId: "sheet-1" },
    })
  })

  it("names the coach's own program so they know what to unlink", async () => {
    const db = fakeDb({ createdById: "coach-a", name: "Push Pull Legs" })
    await expect(assertGoogleSpreadsheetNotInUse(db, "coach-a", "sheet-1")).rejects.toThrow(/Push Pull Legs/)
  })

  it("refuses a spreadsheet another coach already built a program from", async () => {
    const db = fakeDb({ createdById: "coach-b", name: "Chương trình của coach B" })
    const rejection = expect(assertGoogleSpreadsheetNotInUse(db, "coach-a", "sheet-1")).rejects

    await rejection.toThrow(/coach khác/)
  })

  it("does not leak another coach's program name", async () => {
    // The block is the same either way, but the name belongs to that coach's
    // roster, not this one's.
    const db = fakeDb({ createdById: "coach-b", name: "Chương trình của coach B" })
    let error: unknown

    try {
      await assertGoogleSpreadsheetNotInUse(db, "coach-a", "sheet-1")
    } catch (caught) {
      error = caught
    }

    expect((error as Error).message).not.toMatch(/coach B/)
  })
})
