import { describe, expect, it } from "vitest"

import type { AIProvider } from "../../lib/ai/types"
import {
  buildLibraryIndex,
  importProgramFromImages,
  normalizeExerciseName,
  splitReps,
  weekLayout,
  type LibraryVariation,
} from "./program-image-import"

const library: LibraryVariation[] = [
  { equipment: "Barbell", exerciseName: "Incline Bench Press", variationId: "v-incline-bb", variationName: "Barbell" },
  { equipment: "Dumbbell", exerciseName: "Incline Bench Press", variationId: "v-incline-db", variationName: "Dumbbell" },
  { equipment: "Machine", exerciseName: "Leg Press", variationId: "v-leg-press", variationName: "Default" },
  { equipment: "Cable", exerciseName: "Lat Pulldown", variationId: "v-lat-neutral", variationName: "Neutral Grip" },
  { equipment: "Cable", exerciseName: "Lat Pulldown", variationId: "v-lat-single", variationName: "Single Arm" },
  { equipment: "Machine", exerciseName: "Pec Deck Fly", variationId: "v-pec-deck", variationName: "Default" },
  { equipment: "Barbell", exerciseName: "Romanian Deadlift", variationId: "v-rdl", variationName: "Barbell" },
]

describe("normalizeExerciseName", () => {
  it("spells out the shorthand coaches write in sheets", () => {
    expect(normalizeExerciseName("SA Lat Pulldown")).toBe("single arm lat pulldown")
    expect(normalizeExerciseName("1 Arm Cable Lateral Raise (Pulley System)")).toBe("single arm cable lateral raise pulley system")
    expect(normalizeExerciseName("Barbell RDL")).toBe("barbell romanian deadlift")
    expect(normalizeExerciseName("Pecdeck Chest Flyes")).toBe("pec deck chest fly")
  })
})

describe("buildLibraryIndex", () => {
  const index = buildLibraryIndex(library)

  it("matches exact names, with or without the Default variation", () => {
    expect(index.exact("Leg Press")?.variationId).toBe("v-leg-press")
    expect(index.exact("leg  press")?.variationId).toBe("v-leg-press")
    expect(index.exact("Lat Pulldown Single Arm")?.variationId).toBe("v-lat-single")
    expect(index.exact("Incline Barbell Bench Press")).toBeNull()
  })

  it("ranks candidates by the words they share with the row", () => {
    expect(index.candidates("SA Lat Pulldown")[0]?.variationId).toBe("v-lat-single")
    expect(index.candidates("Neutral Grip Lat Pulldown")[0]?.variationId).toBe("v-lat-neutral")
    expect(index.candidates("Incline Barbell Bench Press")[0]?.variationId).toBe("v-incline-bb")
    expect(index.candidates("Barbell RDL")[0]?.variationId).toBe("v-rdl")
    expect(index.candidates("Zercher Carry")).toEqual([])
  })
})

describe("splitReps", () => {
  it("keeps the first range and notes a top set / back-off scheme", () => {
    expect(splitReps("8-12")).toEqual({ note: null, reps: "8-12" })
    expect(splitReps("6-8/5-10")).toEqual({ note: "Reps: 6-8/5-10", reps: "6-8" })
    expect(splitReps("10")).toEqual({ note: null, reps: "10" })
    expect(splitReps(null)).toEqual({ note: null, reps: "10" })
  })
})

describe("weekLayout", () => {
  it("leaves rest days between sessions where the week allows", () => {
    expect(weekLayout(3)).toEqual([1, 3, 5])
    expect(weekLayout(4)).toEqual([1, 2, 4, 5])
    expect(weekLayout(9)).toHaveLength(7)
  })
})

describe("importProgramFromImages", () => {
  function provider(outputs: unknown[]) {
    const requests: Array<{ images?: unknown[]; systemPrompt: string; userPrompt: string }> = []
    return {
      provider: {
        async generateStructuredJSON(request: { images?: unknown[]; systemPrompt: string; userPrompt: string }) {
          requests.push(request)
          return { data: outputs.shift(), tokenUsage: 10 }
        },
        supportsTools: false,
      } as unknown as AIProvider,
      requests,
    }
  }

  const transcription = {
    programName: "Minicut",
    workouts: [
      {
        name: null,
        exercises: [
          { name: "Incline Barbell Bench Press", note: "Topset-Backoffset", reps: "6-8/5-10", rir: 2, sets: 2 },
          { name: "Leg Press", reps: "5-10", rir: 2, sets: 2 },
          { name: "Reverse Pecdeck Flyes", reps: "10-15", rir: 2, sets: null },
          { name: "Zercher Carry", reps: "8-12", sets: 3 },
        ],
      },
      { name: "Pull", exercises: [{ name: "SA Lat Pulldown", reps: "5-10", rir: "2", sets: "2" }] },
    ],
  }

  it("transcribes, matches exact names without the model and asks only about the rest", async () => {
    const { provider: fake, requests } = provider([
      transcription,
      {
        matches: [
          { ref: "r1_1.1", row: "r1_1" },
          // Not the same exercise: the model leaves it for the coach.
          { ref: null, row: "r1_3" },
          // A ref from another row's list is ignored.
          { ref: "r1_1.1", row: "r2_1" },
        ],
      },
    ])

    const result = await importProgramFromImages(fake, {
      images: [{ data: "abc", mediaType: "image/jpeg" }],
      library,
      locale: "vi",
    })

    expect(requests).toHaveLength(2)
    expect(requests[0]?.images).toHaveLength(1)
    expect(requests[1]?.images).toBeUndefined()
    expect(requests[1]?.userPrompt).not.toContain("Leg Press <")
    expect(result.programName).toBe("Minicut")
    expect(result.workouts.map((workout) => [workout.name, workout.scheduledDay])).toEqual([
      ["Buổi 1", 1],
      ["Pull", 4],
    ])

    const [bench, legPress, reverseFly, carry] = result.workouts[0]!.exercises
    expect(bench).toMatchObject({ notes: "Topset-Backoffset · Reps: 6-8/5-10", reps: "6-8", rir: 2, sets: 2, variationId: "v-incline-bb" })
    expect(legPress).toMatchObject({ variationId: "v-leg-press" })
    // Blank sets fall back to the session's usual count.
    expect(reverseFly).toMatchObject({ sets: 2, sourceName: "Reverse Pecdeck Flyes", variationId: null })
    expect(carry).toMatchObject({ sourceName: "Zercher Carry", variationId: null })
    expect(result.workouts[1]!.exercises[0]).toMatchObject({ rir: 2, sets: 2, variationId: null })
    expect(result.unmatchedCount).toBe(3)
  })

  it("skips the matching call when every name is exact", async () => {
    const { provider: fake, requests } = provider([
      { programName: null, workouts: [{ name: "Legs", exercises: [{ name: "Leg Press", reps: "8-12", sets: 3 }] }] },
    ])
    const result = await importProgramFromImages(fake, { images: [{ data: "abc", mediaType: "image/png" }], library, locale: "en" })
    expect(requests).toHaveLength(1)
    expect(result.unmatchedCount).toBe(0)
  })
})
