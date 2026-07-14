import type { SerializedProfile } from "../../auth.service"
import {
  addDays,
  createSection,
  formatDate,
  formatNumber,
  parseExerciseSnapshot,
  snapshotExerciseLabel,
  type ContextPrismaClient,
} from "./helpers"
import type { ContextSection } from "./types"

type SetEntry = {
  reps: number
  startedAt: Date
  volume: number
  weight: number
}

export async function buildProgressionContext(
  db: ContextPrismaClient,
  profile: SerializedProfile,
  now: Date,
): Promise<ContextSection | null> {
  const sixtyDaysAgo = addDays(now, -60)
  const logs = await db.workoutLog.findMany({
    orderBy: { startedAt: "asc" },
    select: {
      exerciseSnapshot: true,
      startedAt: true,
    },
    take: 80,
    where: {
      startedAt: { gte: sixtyDaysAgo },
      userId: profile.id,
    },
  })

  const byExercise = new Map<string, SetEntry[]>()

  for (const log of logs) {
    for (const exercise of parseExerciseSnapshot(log.exerciseSnapshot)) {
      const label = snapshotExerciseLabel(exercise)
      const entries = byExercise.get(label) ?? []

      for (const set of exercise.sets ?? []) {
        if (set.completed === false || set.weight == null) {
          continue
        }

        const reps = set.actualReps ?? set.targetReps ?? 0
        if (reps <= 0) {
          continue
        }

        entries.push({
          reps,
          startedAt: log.startedAt,
          volume: set.weight * reps,
          weight: set.weight,
        })
      }

      if (entries.length > 0) {
        byExercise.set(label, entries)
      }
    }
  }

  const progressions = Array.from(byExercise.entries())
    .map(([name, entries]) => {
      const sorted = entries.slice().sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const best = sorted.reduce((candidate, entry) => (entry.weight > candidate.weight ? entry : candidate), first)
      const totalVolume = sorted.reduce((sum, entry) => sum + entry.volume, 0)
      return {
        best,
        count: sorted.length,
        first,
        last,
        name,
        totalVolume,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  if (progressions.length === 0) {
    return createSection("progression", "EXERCISE PROGRESSION", 82, ["- Chưa đủ set có weight trong 60 ngày gần đây để phân tích progression."])
  }

  const lines = ["- Tiến độ bài tập 60 ngày gần đây:"]

  for (const item of progressions) {
    const delta = item.last.weight - item.first.weight
    const trend = delta > 0 ? `tăng +${formatNumber(delta, 1)}kg` : delta < 0 ? `giảm ${formatNumber(delta, 1)}kg` : "tạ chưa đổi"
    lines.push(
      `  • ${item.name}: ${formatDate(item.first.startedAt)} ${formatNumber(item.first.weight, 1)}kgx${item.first.reps} -> ` +
        `${formatDate(item.last.startedAt)} ${formatNumber(item.last.weight, 1)}kgx${item.last.reps} (${trend}, ` +
        `${item.count} set, best ${formatNumber(item.best.weight, 1)}kgx${item.best.reps}, volume ${formatNumber(item.totalVolume)}kg).`,
    )
  }

  return createSection("progression", "EXERCISE PROGRESSION", 82, lines)
}
