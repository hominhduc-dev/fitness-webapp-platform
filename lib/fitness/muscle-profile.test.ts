import { describe, expect, it } from "vitest"

import { parseMuscleSlugs } from "./muscle-profile"

describe("parseMuscleSlugs", () => {
  it("normalizes spreadsheet labels to muscle slugs", () => {
    expect(parseMuscleSlugs("Upper Back, lower_back, triceps")).toEqual({
      invalid: [],
      muscles: ["upper-back", "lower-back", "triceps"],
    })
  })
})
