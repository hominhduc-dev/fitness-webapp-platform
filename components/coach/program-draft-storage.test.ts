import { afterEach, describe, expect, it } from "vitest"

import {
  clearProgramDraft,
  getProgramDraftStorageKey,
  getProgramServerVersion,
  isSameRoutineDraft,
  pruneRoutineDrafts,
  readProgramDraft,
  stableStringify,
  writeProgramDraft,
  type ProgramDraftForm,
  type Routine,
} from "@/components/coach/program-draft-storage"
import type { RoutineDraftData } from "@/components/workout/routine-builder-dialog"

const pushDay: Routine = {
  exercises: [{ id: "ex-1", reps: "8-10", sets: 3, variationId: "var-bench", weight: "60" }],
  id: "routine-push",
  name: "Push",
  tag: "push",
}

function makeForm(overrides: Partial<ProgramDraftForm> = {}): ProgramDraftForm {
  return {
    description: "",
    difficulty: "beginner",
    duration: "2",
    programGoal: "build_muscle",
    programName: "Bulking",
    routineLibrary: [pushDay],
    schedule: [
      [{ routine: pushDay }, null, { routine: null }],
      [{ routine: null }, null, null],
    ],
    selectedTraineeIds: ["trainee-1"],
    startDate: "",
    ...overrides,
  }
}

const routineDraft: RoutineDraftData = {
  exercises: [
    { displayName: "Bench Press", id: "ex-1", muscleGroup: "chest", reps: "12", rir: "2", sets: 4, variationId: "var-bench", weight: "55" },
  ],
  id: "routine-push",
  name: "Push heavy",
  tag: "push",
}

const key = getProgramDraftStorageKey("coach-1", "program-1")

afterEach(() => {
  window.localStorage.clear()
})

describe("program draft storage", () => {
  it("keeps drafts apart per coach, program and adjusted trainee", () => {
    expect(getProgramDraftStorageKey("coach-1", "program-1")).not.toBe(getProgramDraftStorageKey("coach-2", "program-1"))
    expect(getProgramDraftStorageKey("coach-1")).toBe("coach-program-draft:coach-1:new:")
    expect(getProgramDraftStorageKey("coach-1", "program-1", "trainee-1")).not.toBe(key)
  })

  it("reads back the form and the dialog drafts it wrote", () => {
    const form = makeForm({ programName: "Bulking v2" })
    writeProgramDraft(key, { form, routineDrafts: { "routine:routine-push": routineDraft }, savedAt: "2026-09-30T08:00:00.000Z", serverVersion: "v1" })

    expect(readProgramDraft(key)).toEqual({
      form,
      routineDrafts: { "routine:routine-push": routineDraft },
      savedAt: "2026-09-30T08:00:00.000Z",
      schemaVersion: 1,
      serverVersion: "v1",
    })

    clearProgramDraft(key)
    expect(readProgramDraft(key)).toBeNull()
  })

  it("drops a draft it cannot read back safely", () => {
    window.localStorage.setItem(key, "{not json")
    expect(readProgramDraft(key)).toBeNull()

    window.localStorage.setItem(key, JSON.stringify({ form: { ...makeForm(), schedule: "broken" }, savedAt: "x", schemaVersion: 1, serverVersion: "v1" }))
    expect(readProgramDraft(key)).toBeNull()
    expect(window.localStorage.getItem(key)).toBeNull()

    window.localStorage.setItem(key, JSON.stringify({ form: makeForm(), savedAt: "x", schemaVersion: 99, serverVersion: "v1" }))
    expect(readProgramDraft(key)).toBeNull()
  })

  it("skips a malformed dialog draft but keeps the rest", () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        form: makeForm(),
        routineDrafts: { "routine:routine-push": routineDraft, create: { name: 3 } },
        savedAt: "x",
        schemaVersion: 1,
        serverVersion: "v1",
      }),
    )

    expect(readProgramDraft(key)?.routineDrafts).toEqual({ "routine:routine-push": routineDraft })
  })
})

describe("stableStringify", () => {
  it("does not depend on key order", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(stableStringify({ b: { d: 3, c: 2 }, a: 1 }))
  })

  it("fingerprints a program by content", () => {
    const program = { id: "p", updated: new Date("2026-09-30T00:00:00Z"), workouts: [{ id: "w" }] }
    expect(getProgramServerVersion(program)).toBe(getProgramServerVersion({ workouts: [{ id: "w" }], updated: new Date("2026-09-30T00:00:00Z"), id: "p" }))
    expect(getProgramServerVersion(program)).not.toBe(getProgramServerVersion({ ...program, workouts: [{ id: "w2" }] }))
  })
})

describe("routine drafts", () => {
  it("compares the edited fields, not the draft id", () => {
    expect(isSameRoutineDraft(routineDraft, { ...routineDraft, id: undefined })).toBe(true)
    expect(isSameRoutineDraft(routineDraft, { ...routineDraft, name: "Push" })).toBe(false)
  })

  it("forgets drafts of sessions the program no longer has", () => {
    const drafts = { create: routineDraft, "routine:gone": routineDraft, "routine:routine-push": routineDraft }
    expect(Object.keys(pruneRoutineDrafts(makeForm(), drafts)).sort()).toEqual(["create", "routine:routine-push"])
    expect(Object.keys(pruneRoutineDrafts(makeForm({ routineLibrary: [], schedule: [] }), drafts))).toEqual(["create"])
  })
})
