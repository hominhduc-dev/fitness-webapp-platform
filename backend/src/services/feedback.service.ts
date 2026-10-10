import { Prisma } from "@prisma/client"
import { ensurePrisma } from "./fitness-data/shared/guards"
import { createFeedbackSchema, feedbackPaginationSchema, listFeedbackSchema, updateFeedbackSchema, type CreateFeedbackInput, type FeedbackListQuery, type FeedbackUpdateInput } from "../routes/feedback.schemas"
import type { SerializedProfile } from "./auth.service"
import { ConflictError, ForbiddenError, NotFoundError, TooManyRequestsError, ValidationError } from "./errors"

const summarySelect = { id: true, category: true, message: true, pagePath: true, appVersion: true, status: true, createdAt: true, updatedAt: true } satisfies Prisma.UserFeedbackSelect
const reporterSelect = { id: true, name: true, email: true, role: true }
type Summary = Prisma.UserFeedbackGetPayload<{ select: typeof summarySelect }>
function serialize(record: Summary & { user?: { id: string; name: string | null; email: string; role: string }; screenshot?: string | null; userAgent?: string | null }) {
  const { user, ...feedback } = record
  return { ...feedback, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), ...(user ? { reporter: user } : {}) }
}
function requireAdmin(profile: SerializedProfile) {
  if (profile.role !== "admin") throw new ForbiddenError("Chỉ admin được quản lý phản hồi.")
}
function parse<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new ValidationError("Dữ liệu phản hồi không hợp lệ.")
  return result.data
}

async function createFeedback(profile: SerializedProfile, raw: CreateFeedbackInput, userAgent?: string) {
  const prisma = ensurePrisma()
  const input = parse(createFeedbackSchema, raw)
  // A per-account backstop also prevents token refresh from resetting the route limiter.
  const count = await prisma.userFeedback.count({ where: { userId: profile.id, createdAt: { gte: new Date(Date.now() - 600_000) } } })
  if (count >= 10) throw new TooManyRequestsError("Bạn đã gửi nhiều phản hồi. Vui lòng thử lại sau 10 phút.")
  return serialize(await prisma.userFeedback.create({ data: { ...input, userId: profile.id, userAgent: userAgent?.slice(0, 512) }, select: summarySelect }))
}
async function listFeedback(profile: SerializedProfile, raw: FeedbackListQuery, own = false) {
  if (!own) requireAdmin(profile)
  const prisma = ensurePrisma()
  const query = own ? parse(feedbackPaginationSchema, raw) : parse(listFeedbackSchema, raw)
  const filters = query as FeedbackListQuery
  const where: Prisma.UserFeedbackWhereInput = own ? { userId: profile.id } : { status: filters.status, category: filters.category }
  const [records, total] = await prisma.$transaction([
    prisma.userFeedback.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { ...summarySelect, ...(!own ? { user: { select: reporterSelect } } : {}) } }),
    prisma.userFeedback.count({ where }),
  ])
  return { items: records.map(serialize), total, page: query.page, limit: query.limit }
}
async function getFeedback(profile: SerializedProfile, id: string) {
  const prisma = ensurePrisma()
  const record = await prisma.userFeedback.findFirst({ where: { id, ...(profile.role !== "admin" ? { userId: profile.id } : {}) }, select: { ...summarySelect, screenshot: true, userAgent: true, ...(profile.role === "admin" ? { user: { select: reporterSelect } } : {}) } })
  if (!record) throw new NotFoundError("Không tìm thấy phản hồi.")
  return serialize(record)
}
async function updateFeedback(profile: SerializedProfile, id: string, raw: FeedbackUpdateInput) {
  requireAdmin(profile)
  const prisma = ensurePrisma()
  const input = parse(updateFeedbackSchema, raw)
  return prisma.$transaction(async (tx) => {
    const expected = new Date(input.expectedUpdatedAt)
    const changed = await tx.userFeedback.updateMany({ where: { id, updatedAt: expected }, data: { status: input.status, updatedAt: new Date(Math.max(Date.now(), expected.getTime() + 1)) } })
    if (!changed.count) {
      if (!await tx.userFeedback.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundError("Không tìm thấy phản hồi.")
      throw new ConflictError("Phản hồi đã được cập nhật. Hãy tải lại trước khi đổi trạng thái.", { code: "FEEDBACK_STALE" })
    }
    const record = await tx.userFeedback.findUnique({ where: { id }, select: summarySelect })
    if (!record) throw new NotFoundError("Không tìm thấy phản hồi.")
    return serialize(record)
  })
}
export { createFeedback, listFeedback, getFeedback, updateFeedback }
