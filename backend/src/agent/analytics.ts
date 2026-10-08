import type { Prisma } from "@prisma/client"
import { calculateE1RM } from "../services/fitness-data/shared/e1rm"

type Log = { id: string; startedAt: Date; programId: string | null; exerciseSnapshot: Prisma.JsonValue | null }
type Sample = { date: number; e1rm: number; reps: number; rir: number | null; volume: number }
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** Compare only the same program and stable variation ID. Names are display labels, not identity. */
export function comparePeriods(logs: Log[], now: Date, days: number, limited = false) {
  const midpoint = now.getTime() - days * 86_400_000
  const groups = new Map<string, { label: string; before: Sample[]; after: Sample[]; prescriptions: Set<string> }>()
  let missingIdentity = 0
  for (const log of logs) {
    for (const raw of Array.isArray(log.exerciseSnapshot) ? log.exerciseSnapshot : []) {
      const exercise = record(raw)
      const variation = record(exercise.variation)
      const base = record(exercise.exercise)
      const id = variation.id ?? exercise.variationId
      if (typeof id !== "string" || !id.trim() || !log.programId) { missingIdentity++; continue }
      if (variation.activityType && variation.activityType !== "strength") continue
      const sets = (Array.isArray(exercise.sets) ? exercise.sets : []).map(record).filter(set =>
        set.completed === true && finite(set.weight) && set.weight > 0 && finite(set.actualReps) && set.actualReps > 0 && set.actualReps <= 15)
      if (!sets.length) continue
      const values = sets.map(set => calculateE1RM(set.weight as number, set.actualReps as number, finite(set.rir) ? set.rir : null) as number)
      const best = values.indexOf(Math.max(...values))
      const sample: Sample = { date: log.startedAt.getTime(), e1rm: values[best], reps: sets[best].actualReps as number,
        rir: finite(sets[best].rir) ? sets[best].rir : null,
        volume: sets.reduce((sum, set) => sum + (set.weight as number) * (set.actualReps as number), 0) }
      const key = `${log.programId}:${id}`
      const group = groups.get(key) ?? { label: `${String(base.name ?? "")} / ${String(variation.name ?? id)}`, before: [], after: [], prescriptions: new Set<string>() }
      group.prescriptions.add(JSON.stringify((Array.isArray(exercise.sets) ? exercise.sets : []).map(record).map(set => [set.targetRepsMin, set.targetReps, set.targetRir, set.intensityTag])))
      const bucket = sample.date < midpoint ? group.before : group.after
      // Multiple exercise slots in one session count as one exposure.
      const existing = bucket.find(item => item.date === sample.date)
      if (existing) { existing.volume += sample.volume; if (sample.e1rm > existing.e1rm) Object.assign(existing, { e1rm: sample.e1rm, reps: sample.reps, rir: sample.rir }) }
      else bucket.push(sample)
      groups.set(key, group)
    }
  }
  const mean = (samples: Sample[], field: "e1rm" | "volume") => samples.length ? samples.reduce((sum, sample) => sum + sample[field], 0) / samples.length : null
  const comparisons = [...groups].slice(0, 12).map(([key, group]) => {
    const before = mean(group.before, "e1rm"), after = mean(group.after, "e1rm")
    const changePercent = before && after ? (after - before) / before * 100 : null
    const enough = group.before.length >= 3 && group.after.length >= 3
    const rirComplete = [...group.before, ...group.after].every(sample => sample.rir != null)
    const prescriptionChanged = group.prescriptions.size > 1
    return { key, label: group.label, beforeSessions: group.before.length, afterSessions: group.after.length,
      beforeE1rm: before, afterE1rm: after, changePercent,
      beforeVolume: mean(group.before, "volume"), afterVolume: mean(group.after, "volume"),
      prescriptionChanged, confidence: enough && rirComplete && !limited && !prescriptionChanged ? "moderate" : "low",
      signal: !enough || !rirComplete || limited || prescriptionChanged ? "insufficient_data" : changePercent != null && changePercent > 2 ? "improving" : changePercent != null && changePercent < -2 ? "declining" : "possible_plateau",
      evidence: { before: group.before.sort((a, b) => b.date - a.date).slice(0, 3), after: group.after.sort((a, b) => b.date - a.date).slice(0, 3) } }
  })
  return { daysPerPeriod: days, limited: limited || groups.size > 12, missingIdentity, comparisons,
    caveat: "Possible plateau is a screening signal, not a diagnosis. Same program/variation only; program revisions, sleep, adherence and readiness need review. Missing identity and high-rep/bodyweight sets are excluded." }
}
