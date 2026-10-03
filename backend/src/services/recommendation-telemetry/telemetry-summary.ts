/**
 * Rolls recommendation events up into the numbers the engine is tuned on:
 * how often each kind of suggestion is followed, and how the next session went
 * when it was. Pure: the service supplies grouped counts.
 */

type ComplianceKey = "followed" | "modified" | "not_attempted" | "partial"
type OutcomeKey = "insufficient_data" | "maintained" | "regressed" | "rolled_back" | "successful"

type GroupedCount = {
  abandoned: boolean
  action: string
  algorithmVersion: string
  count: number
  equipment: string | null
  outcome: OutcomeKey | null
  overallCompliance: ComplianceKey | null
}

type TelemetryRow = {
  action: string
  algorithmVersion: string
  /** Sessions discarded without a log. */
  abandoned: number
  compliance: Record<ComplianceKey, number>
  equipment?: string | null
  /** Next-session outcomes of every suggestion that was tried. */
  outcomes: Record<OutcomeKey, number>
  /** The same, for the suggestions that were followed. */
  outcomesAfterFollowed: Record<OutcomeKey, number>
  /** Shown but not yet logged or discarded. */
  pending: number
  rates: {
    followedPct: number | null
    modifiedPct: number | null
    notAttemptedPct: number | null
    partialPct: number | null
    rollbackAfterFollowedPct: number | null
    rollbackPct: number | null
    successAfterFollowedPct: number | null
  }
  shown: number
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)

const emptyOutcomes = (): Record<OutcomeKey, number> => ({ insufficient_data: 0, maintained: 0, regressed: 0, rolled_back: 0, successful: 0 })

/** Outcomes that say something: insufficient data is left out of the rates. */
const judged = (outcomes: Record<OutcomeKey, number>) =>
  outcomes.successful + outcomes.maintained + outcomes.regressed + outcomes.rolled_back

function emptyRow(key: Pick<TelemetryRow, "action" | "algorithmVersion" | "equipment">): TelemetryRow {
  return {
    ...key,
    abandoned: 0,
    compliance: { followed: 0, modified: 0, not_attempted: 0, partial: 0 },
    outcomes: emptyOutcomes(),
    outcomesAfterFollowed: emptyOutcomes(),
    pending: 0,
    rates: {
      followedPct: null,
      modifiedPct: null,
      notAttemptedPct: null,
      partialPct: null,
      rollbackAfterFollowedPct: null,
      rollbackPct: null,
      successAfterFollowedPct: null,
    },
    shown: 0,
  }
}

function summarizeTelemetry(groups: readonly GroupedCount[], options: { byEquipment: boolean }): TelemetryRow[] {
  const rows = new Map<string, TelemetryRow>()
  for (const group of groups) {
    const equipment = options.byEquipment ? group.equipment ?? null : undefined
    const key = [group.algorithmVersion, group.action, equipment ?? ""].join("|")
    const row = rows.get(key) ?? emptyRow({ action: group.action, algorithmVersion: group.algorithmVersion, ...(options.byEquipment ? { equipment } : {}) })
    row.shown += group.count
    if (group.overallCompliance) {
      row.compliance[group.overallCompliance] += group.count
      if (group.outcome) row.outcomes[group.outcome] += group.count
      if (group.overallCompliance === "followed" && group.outcome) row.outcomesAfterFollowed[group.outcome] += group.count
    } else if (group.abandoned) {
      row.abandoned += group.count
    } else {
      row.pending += group.count
    }
    rows.set(key, row)
  }

  return Array.from(rows.values())
    .map((row) => {
      const evaluated = Object.values(row.compliance).reduce((sum, value) => sum + value, 0)
      const afterFollowed = judged(row.outcomesAfterFollowed)
      return {
        ...row,
        rates: {
          followedPct: pct(row.compliance.followed, evaluated),
          modifiedPct: pct(row.compliance.modified, evaluated),
          notAttemptedPct: pct(row.compliance.not_attempted, evaluated),
          partialPct: pct(row.compliance.partial, evaluated),
          rollbackAfterFollowedPct: pct(row.outcomesAfterFollowed.rolled_back, afterFollowed),
          rollbackPct: pct(row.outcomes.rolled_back, judged(row.outcomes)),
          successAfterFollowedPct: pct(row.outcomesAfterFollowed.successful, afterFollowed),
        },
      }
    })
    .sort((left, right) =>
      left.algorithmVersion.localeCompare(right.algorithmVersion)
      || left.action.localeCompare(right.action)
      || (left.equipment ?? "").localeCompare(right.equipment ?? ""))
}

export { summarizeTelemetry }
export type { GroupedCount, TelemetryRow }
