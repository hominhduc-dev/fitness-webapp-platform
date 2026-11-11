import { describe, expect, it } from "vitest"

import type { SetTargetAssignment } from "../../domain/set-target"
import { buildProgramTreeCreateManyData } from "./core"

function buildRowsFor(exercise: { reps: number; repsMin?: number; rir?: number; sets: number; setTargets?: SetTargetAssignment[]; weight?: number }) {
  return buildProgramTreeCreateManyData("program-1", [
    { exercises: [{ variationId: "variation-1", ...exercise }], name: "Day 1", scheduledDay: 1 },
  ]).setRows.map(({ rir, setNumber, targetReps, targetRepsMin, weight }) => ({ rir, setNumber, targetReps, targetRepsMin, weight }))
}

describe("program set rows carry per-set targets", () => {
  it("gives the back-off sets their own reps, weight and RIR and the top set the exercise's", () => {
    const rows = buildRowsFor({
      reps: 8,
      repsMin: 6,
      rir: 1,
      sets: 3,
      setTargets: [
        { reps: 10, repsMin: 5, rir: 2, setNumber: 2, weight: 50 },
        { reps: 10, repsMin: 5, rir: 2, setNumber: 3, weight: 50 },
      ],
      weight: 65,
    })

    expect(rows).toEqual([
      { rir: 1, setNumber: 1, targetReps: 8, targetRepsMin: 6, weight: 65 },
      { rir: 2, setNumber: 2, targetReps: 10, targetRepsMin: 5, weight: 50 },
      { rir: 2, setNumber: 3, targetReps: 10, targetRepsMin: 5, weight: 50 },
    ])
  })

  it("keeps the exercise's weight and RIR on a set whose override leaves them out", () => {
    const rows = buildRowsFor({ reps: 8, rir: 2, sets: 2, setTargets: [{ reps: 12, setNumber: 2 }], weight: 40 })

    expect(rows[1]).toEqual({ rir: 2, setNumber: 2, targetReps: 12, targetRepsMin: undefined, weight: 40 })
  })

  it("drops overrides for sets the exercise does not have", () => {
    const rows = buildRowsFor({ reps: 8, sets: 2, setTargets: [{ reps: 12, setNumber: 5 }] })

    expect(rows.map((row) => row.targetReps)).toEqual([8, 8])
  })

  it("rejects a back-off range whose start is not below its end, naming the set", () => {
    expect(() => buildRowsFor({ reps: 8, sets: 2, setTargets: [{ reps: 5, repsMin: 10, setNumber: 2 }] })).toThrow(/set 2/)
  })
})
