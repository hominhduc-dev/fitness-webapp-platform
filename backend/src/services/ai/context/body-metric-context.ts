import type { SerializedProfile } from "../../auth.service"
import { addDays, createSection, formatDate, formatNumber, summarizeText, type ContextPrismaClient } from "./helpers"
import type { ContextSection } from "./types"

export async function buildBodyMetricContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
  now: Date,
): Promise<ContextSection | null> {
  const ninetyDaysAgo = addDays(now, -90)
  const thirtyDaysAgo = addDays(now, -30)

  const entries = await db.bodyMetricEntry.findMany({
    orderBy: { recordedAt: "desc" },
    take: 20,
    where: {
      recordedAt: { gte: ninetyDaysAgo },
      traineeId: profile.id,
    },
  })

  const latest = entries[0]
  const previous30 = entries.find((entry) => entry.recordedAt <= thirtyDaysAgo) ?? entries[entries.length - 1]
  const lines: string[] = []

  if (!latest) {
    lines.push("- Chưa có body metric trong 90 ngày gần đây.")
    if (profile.targetWeightKg != null) {
      lines.push(`- Mục tiêu cân nặng đã đặt: ${formatNumber(profile.targetWeightKg, 1)}kg.`)
    }
    return createSection("body_metrics", "BODY METRICS", 75, lines)
  }

  lines.push(
    `- Gần nhất (${formatDate(latest.recordedAt)}): ` +
      [
        latest.weightKg != null ? `${formatNumber(latest.weightKg, 1)}kg` : "",
        latest.bodyFatPct != null ? `${formatNumber(latest.bodyFatPct, 1)}% body fat` : "",
        latest.waistCm != null ? `eo ${formatNumber(latest.waistCm, 1)}cm` : "",
      ].filter(Boolean).join(", "),
  )

  if (profile.targetWeightKg != null && latest.weightKg != null) {
    const diff = latest.weightKg - profile.targetWeightKg
    const direction = diff > 0 ? `còn ${formatNumber(diff, 1)}kg để giảm` : diff < 0 ? `dưới mục tiêu ${formatNumber(Math.abs(diff), 1)}kg` : "đúng mục tiêu"
    lines.push(`- So với target ${formatNumber(profile.targetWeightKg, 1)}kg: ${direction}.`)
  }

  if (previous30 && previous30.id !== latest.id && latest.weightKg != null && previous30.weightKg != null) {
    const delta = latest.weightKg - previous30.weightKg
    const sign = delta > 0 ? "+" : ""
    lines.push(`- Trend gần 30-90 ngày: ${sign}${formatNumber(delta, 1)}kg từ ${formatDate(previous30.recordedAt)}.`)
  }

  const latestNote = summarizeText(latest.note, 140)
  if (latestNote) {
    lines.push(`- Note body metric mới nhất: ${latestNote}`)
  }

  return createSection("body_metrics", "BODY METRICS", 75, lines)
}
