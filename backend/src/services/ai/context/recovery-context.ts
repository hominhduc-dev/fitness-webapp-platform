import type { SerializedProfile } from "../../auth.service"
import { addDays, createSection, formatDate, formatNumber, type ContextPrismaClient } from "./helpers"
import type { ContextSection } from "./types"

/** Readiness is calculated by the server-side recovery algorithm; AI only explains it. */
export async function buildRecoveryContext(db: ContextPrismaClient, profile: SerializedProfile, now: Date): Promise<ContextSection | null> {
  if (!db.recoveryCheckIn) return null
  const since = addDays(now, -7)
  const checkIn = await db.recoveryCheckIn.findFirst({
    include: { muscles: { orderBy: { muscleSlug: "asc" } } },
    orderBy: [{ checkInDate: "desc" }, { updatedAt: "desc" }],
    where: { checkInDate: { gte: since, lte: now }, userId: profile.id },
  })

  if (!checkIn) {
    return createSection("recovery", "RECOVERY / READINESS", 88, ["- Chưa có check-in phục hồi trong 7 ngày gần đây. Không tự suy đoán mức sẵn sàng."])
  }

  const sore = checkIn.muscles.filter((m) => m.soreness >= 3 || (m.pain ?? 0) >= 3).map((m) => `${m.muscleSlug} (soreness ${m.soreness}/5${m.pain != null ? `, pain ${m.pain}/5` : ""})`)
  const lines = [
    `- Check-in ${formatDate(checkIn.checkInDate)}: readiness ${checkIn.readinessScore != null ? `${formatNumber(checkIn.readinessScore, 0)}/100` : "chưa tính"}, fatigue ${checkIn.fatigue}/5${checkIn.sleepQuality != null ? `, sleep quality ${checkIn.sleepQuality}/5` : ""}${checkIn.sleepMinutes != null ? `, sleep ${checkIn.sleepMinutes} phút` : ""}${checkIn.stress != null ? `, stress ${checkIn.stress}/5` : ""}.`,
    sore.length ? `- Nhóm cơ cần thận trọng: ${sore.join(", ")}. Giảm hoặc thay bài nếu buổi kế tiếp tác động các nhóm này.` : "- Không có nhóm cơ đau/soreness cao được ghi nhận.",
  ]
  return createSection("recovery", "RECOVERY / READINESS", 88, lines)
}
