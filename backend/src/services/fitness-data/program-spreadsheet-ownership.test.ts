import { describe, expect, it, vi } from "vitest"

import { assertGoogleSpreadsheetNotOwnedByAnotherCoach } from "./core"

function fakeDb(program: { id: string } | null) {
  return { program: { findFirst: vi.fn().mockResolvedValue(program) } } as unknown as Parameters<
    typeof assertGoogleSpreadsheetNotOwnedByAnotherCoach
  >[0]
}

describe("assertGoogleSpreadsheetNotOwnedByAnotherCoach", () => {
  it("does nothing when no spreadsheet is linked", async () => {
    const db = fakeDb(null)
    await expect(assertGoogleSpreadsheetNotOwnedByAnotherCoach(db, "coach-a", undefined)).resolves.toBeUndefined()
    expect(db.program.findFirst).not.toHaveBeenCalled()
  })

  it("allows a coach to reuse their own spreadsheet across programs", async () => {
    // The lookup itself excludes this coach (`createdById: { not: coachId }`),
    // so this only models "no OTHER coach's program found".
    const db = fakeDb(null)
    await expect(
      assertGoogleSpreadsheetNotOwnedByAnotherCoach(db, "coach-a", "sheet-1"),
    ).resolves.toBeUndefined()
    expect(db.program.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { createdById: { not: "coach-a" }, googleSpreadsheetId: "sheet-1" },
    })
  })

  it("refuses a spreadsheet another coach already built a program from", async () => {
    const db = fakeDb({ id: "program-owned-by-coach-b" })
    await expect(assertGoogleSpreadsheetNotOwnedByAnotherCoach(db, "coach-a", "sheet-1")).rejects.toThrow(
      /coach khác/,
    )
  })
})
