import { createHash } from "crypto"
import { prisma } from "../lib/prisma"
import { logger, withRequestContext } from "../lib/logger"
import { createRun } from "./service"
import { getLocalClock, isDailyReminderDue } from "../services/notifications/reminder-schedule"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../services/notifications/notification-preferences.service"
let scanCursor: string | undefined

/** Explicit opt-in only; existing notification preferences determine the review schedule. */
export async function enqueueWeeklyReviews(now = new Date()) {
  if (!prisma) return
  let cursor = scanCursor
  for (let page = 0; page < 10; page++) {
    const rows = await prisma.agentMemory.findMany({ where: { key: "weekly_review_enabled", content: "true", actor: { role: "coach", isActive: true, coachApprovalStatus: "approved" } },
      orderBy: { id: "asc" }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, actorId: true, actor: { select: { notificationPreference: true } } } })
    for (const row of rows) {
      const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...row.actor.notificationPreference }
      const clock = getLocalClock(now, preferences.timeZone)
      if (!preferences.coachWeeklyReviewEnabled || !isDailyReminderDue(clock, preferences.coachWeeklyReviewTime, [preferences.coachWeeklyReviewDay])) continue
      const hex = createHash("sha256").update(`agent-weekly:${row.actorId}:${clock.weekStartKey}`).digest("hex")
      const requestKey = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
      try {
        await withRequestContext({ requestId: `weekly-${requestKey}`, method: "WORKER", path: "/agent/weekly", timeZone: clock.timeZone }, () => createRun(row.actorId, {
          requestKey, message: "Rà soát tuần này cho các học viên được giao: dùng coach_weekly_review theo trang, đối chiếu progression và readiness. Nêu phạm vi, dữ liệu thiếu và ưu tiên cần theo dõi. Không tự ghi chú hoặc chỉnh program; chỉ báo cáo." }))
      } catch (error) { logger.warn("weekly agent review not queued", { actorId: row.actorId, code: (error as { code?: string }).code ?? "QUEUE_FAILED" }) }
    }
    if (rows.length < 50) { scanCursor = undefined; break }
    cursor = rows[rows.length - 1].id
    scanCursor = cursor
  }
}
