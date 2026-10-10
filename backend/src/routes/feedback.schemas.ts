import { z } from "zod"

const MAX_SCREENSHOT_BYTES = 1024 * 1024

function isFeedbackScreenshot(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) return false
  const bytes = Buffer.from(match[2], "base64")
  if (bytes.length > MAX_SCREENSHOT_BYTES || bytes.toString("base64") !== match[2]) return false
  if (match[1] === "png") return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR"
  if (match[1] === "jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
  return bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))
}

const feedbackCategorySchema = z.enum(["bug", "suggestion"])
const feedbackStatusSchema = z.enum(["new", "in_progress", "resolved"])
const createFeedbackSchema = z.object({
  category: feedbackCategorySchema,
  message: z.string().trim().min(10).max(3000),
  pagePath: z.string().max(512).refine((value) => /^\/(?!\/)/.test(value) && !/[?#\\\x00-\x1f]/.test(value), "Chỉ gửi đường dẫn trang, không kèm query hoặc fragment.").optional(),
  appVersion: z.string().trim().max(64).optional(),
  screenshot: z.string().max(Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4 + 40).refine(isFeedbackScreenshot, "Ảnh phải là PNG, JPEG hoặc WebP hợp lệ, tối đa 1 MB.").optional(),
}).strict()
const feedbackPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
const listFeedbackSchema = feedbackPaginationSchema.extend({ status: feedbackStatusSchema.optional(), category: feedbackCategorySchema.optional() })
const feedbackIdSchema = z.object({ id: z.uuid() })
const updateFeedbackSchema = z.object({ status: feedbackStatusSchema, expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict()

export { createFeedbackSchema, feedbackPaginationSchema, listFeedbackSchema, feedbackIdSchema, updateFeedbackSchema, isFeedbackScreenshot }
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
export type FeedbackListQuery = z.infer<typeof listFeedbackSchema>
export type FeedbackUpdateInput = z.infer<typeof updateFeedbackSchema>
