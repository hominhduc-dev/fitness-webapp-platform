import { describe, expect, it } from "vitest"

import { formatAppVersion } from "@/lib/app-version"

describe("formatAppVersion", () => {
  it("shows the version alone when the build exposed no commit", () => {
    expect(formatAppVersion("1.4.2", undefined)).toBe("1.4.2")
    expect(formatAppVersion("1.4.2", "")).toBe("1.4.2")
    expect(formatAppVersion("1.4.2", "   ")).toBe("1.4.2")
  })

  it("appends a short commit ref so a tester can name the exact build", () => {
    expect(formatAppVersion("1.4.2", "a1b2c3d4e5f6a7b8")).toBe("1.4.2 (a1b2c3d)")
  })

  it("keeps a ref that is already short", () => {
    expect(formatAppVersion("1.4.2", "abc123")).toBe("1.4.2 (abc123)")
  })

  it("renders nothing at all when no version was injected", () => {
    expect(formatAppVersion(undefined, "a1b2c3d")).toBeNull()
    expect(formatAppVersion("", "a1b2c3d")).toBeNull()
    expect(formatAppVersion("  ", undefined)).toBeNull()
  })
})
