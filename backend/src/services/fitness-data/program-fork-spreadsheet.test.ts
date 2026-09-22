import { describe, expect, it } from "vitest"

import { canForkKeepSpreadsheetLink } from "./core"

describe("canForkKeepSpreadsheetLink", () => {
  it("carries the link over when the trainee was the program's only assignee", () => {
    expect(canForkKeepSpreadsheetLink(true, 0)).toBe(true)
  })

  it("drops the link when another trainee is still assigned to the original", () => {
    // Keeping it would leave two programs writing into one sheet — the
    // conflict `assertSpreadsheetNotSharedWithAnotherTrainee` refuses on.
    expect(canForkKeepSpreadsheetLink(true, 1)).toBe(false)
    expect(canForkKeepSpreadsheetLink(true, 3)).toBe(false)
  })

  it("has nothing to carry over when the program was never imported from a sheet", () => {
    expect(canForkKeepSpreadsheetLink(false, 0)).toBe(false)
  })
})
