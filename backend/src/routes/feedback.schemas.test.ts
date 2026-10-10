import { describe, expect, it } from "vitest"
import { createFeedbackSchema, feedbackPaginationSchema, isFeedbackScreenshot, updateFeedbackSchema } from "./feedback.schemas"

const input = { category: "bug", message: "Không thể lưu buổi tập" }
describe("feedback input privacy and limits", () => {
  it("accepts only a pathname and strips no unknown sensitive fields silently", () => {
    expect(createFeedbackSchema.safeParse({ ...input, pagePath: "/chat" }).success).toBe(true)
    for (const pagePath of ["https://example.com", "//host", "/chat?token=secret", "/chat#fragment", "/\\host"]) expect(createFeedbackSchema.safeParse({ ...input, pagePath }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...input, accessToken: "private" }).success).toBe(false)
  })
  it("bounds description, version and pagination", () => {
    expect(createFeedbackSchema.safeParse({ ...input, message: "short" }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...input, message: "a".repeat(3001) }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...input, appVersion: "a".repeat(65) }).success).toBe(false)
    expect(feedbackPaginationSchema.parse({})).toEqual({ page: 1, limit: 20 })
    expect(feedbackPaginationSchema.safeParse({ limit: 51 }).success).toBe(false)
    expect(feedbackPaginationSchema.safeParse({ page: -1 }).success).toBe(false)
  })
  it("checks decoded image signature, MIME, encoding and size", () => {
    const png = Buffer.alloc(24)
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
    png.write("IHDR", 12)
    expect(isFeedbackScreenshot(`data:image/png;base64,${png.toString("base64")}`)).toBe(true)
    expect(isFeedbackScreenshot(`data:image/jpeg;base64,${png.toString("base64")}`)).toBe(false)
    expect(isFeedbackScreenshot(`data:image/png;base64,${Buffer.alloc(1024 * 1024 + 1).toString("base64")}`)).toBe(false)
    expect(isFeedbackScreenshot("data:image/svg+xml;base64,PHN2Zz4=" )).toBe(false)
    expect(isFeedbackScreenshot("data:image/png;base64,a===")).toBe(false)
  })
  it("requires a valid concurrency timestamp and status", () => {
    expect(updateFeedbackSchema.safeParse({ status: "resolved" }).success).toBe(false)
    expect(updateFeedbackSchema.safeParse({ status: "deleted", expectedUpdatedAt: "2026-10-10T12:00:00Z" }).success).toBe(false)
  })
})
