import { describe, expect, it } from "vitest"

import type { AIProvider } from "../../lib/ai/types"
import {
  buildLibraryIndex,
  importProgramFromImages,
  normalizeExerciseName,
  parseImageWeights,
  setSchemeTags,
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
  // The picker shows the variation words in front of the exercise name.
  {
    displayName: "High to Low Cable Chest Fly",
    equipment: "Cable",
    exerciseName: "Cable Chest Fly",
    variationId: "v-fly-high-low",
    variationName: "High to Low",
  },
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

  it("matches the name the coach sees in the exercise picker", () => {
    expect(index.exact("High to Low Cable Chest Fly")?.variationId).toBe("v-fly-high-low")
    expect(index.exact("Cable Chest Fly High to Low")?.variationId).toBe("v-fly-high-low")
    expect(index.candidates("High-to-Low Cable Flyes")[0]?.variationId).toBe("v-fly-high-low")
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

describe("setSchemeTags", () => {
  const topBackOff = (sets: number, top = 1) =>
    Array.from({ length: sets }, (_, index) => ({ setNumber: index + 1, tag: index < top ? "top_set" : "back_off" }))

  it.each(["Topset-Backoffset", "1 Topset-Backoffset", "top/backoff", "Top set + back-off sets", "TOP SET - BACKOFF"])(
    "reads %s as a top set followed by back-off sets",
    (scheme) => {
      expect(setSchemeTags(scheme, 3)).toEqual(topBackOff(3))
    },
  )

  it("takes the count of top sets from the scheme, leaving at least one back-off set", () => {
    expect(setSchemeTags("2 Topset-Backoffset", 4)).toEqual(topBackOff(4, 2))
    expect(setSchemeTags("3 top/backoff", 2)).toEqual(topBackOff(2, 1))
    expect(setSchemeTags("Topset-Backoffset", 1)).toEqual([{ setNumber: 1, tag: "top_set" }])
  })

  it("reads the Method-cell spellings the sheet import accepts", () => {
    expect(setSchemeTags("Drop set", 3)).toEqual([{ setNumber: 3, tag: "drop_set" }])
    expect(setSchemeTags("all:rp", 2)).toEqual([{ setNumber: 1, tag: "rest_pause" }, { setNumber: 2, tag: "rest_pause" }])
  })

  it.each([null, "", "Straight sets", "Pyramid", "Superset with B2"])("names no method for %s", (scheme) => {
    expect(setSchemeTags(scheme, 3)).toBeNull()
  })
})

describe("parseImageWeights", () => {
  it("reads a comma between whole numbers as one weight per set", () => {
    expect(parseImageWeights("65,50", 2)).toEqual([65, 50])
    expect(parseImageWeights("100,80,80", 3)).toEqual([100, 80, 80])
    expect(parseImageWeights("65, 50", 2)).toEqual([65, 50])
    expect(parseImageWeights("65/50", 2)).toEqual([65, 50])
    expect(parseImageWeights("62,5/50", 2)).toEqual([62.5, 50])
  })

  it("keeps real decimals working", () => {
    expect(parseImageWeights("62,5", 2)).toEqual([62.5])
    expect(parseImageWeights("62.5", 3)).toEqual([62.5])
    expect(parseImageWeights("22,50", 1)).toEqual([22.5])
    expect(parseImageWeights("60 kg", 3)).toEqual([60])
  })

  it("returns nothing for blank or unreadable cells", () => {
    expect(parseImageWeights(null, 3)).toEqual([])
    expect(parseImageWeights("", 3)).toEqual([])
    expect(parseImageWeights("BW", 3)).toEqual([])
    expect(parseImageWeights("RPE 8", 3)).toEqual([])
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
          {
            name: "Incline Barbell Bench Press",
            reps: "6-8/5-10",
            rir: 2,
            setScheme: "Topset-Backoffset",
            sets: 2,
            weight: "65,50",
            weightUnit: "kg",
          },
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
    expect(bench).toMatchObject({
      // The top set and its back-off set become two rows, so neither needs a note.
      backOff: { reps: "5-10", weight: 50 },
      notes: "",
      reps: "6-8",
      rir: 2,
      setIntensityTags: [{ setNumber: 1, tag: "top_set" }, { setNumber: 2, tag: "back_off" }],
      sets: 2,
      variationId: "v-incline-bb",
      weight: 65,
    })
    expect(legPress).toMatchObject({ backOff: null, setIntensityTags: [], variationId: "v-leg-press" })
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

  async function importExercise(fields: Record<string, unknown>, locale: "en" | "vi" = "en") {
    const { provider: fake } = provider([
      { programName: null, workouts: [{ name: "Legs", exercises: [{ name: "Leg Press", reps: "10", sets: 3, ...fields }] }] },
    ])
    const result = await importProgramFromImages(fake, { images: [{ data: "abc", mediaType: "image/png" }], library, locale })
    return result.workouts[0]!.exercises[0]!
  }

  it("preserves rest seconds and explicit kg loads", async () => {
    expect(await importExercise({ restTime: "120", weight: "62.5", weightUnit: "kg" })).toMatchObject({
      notes: "", restTime: 120, weight: 62.5,
    })
  })

  it.each(["lb", "lbs", "LB", "pounds"])("converts an explicit %s load to kg", async (weightUnit) => {
    expect(await importExercise({ weight: 135, weightUnit })).toMatchObject({ notes: "", weight: 61.23 })
  })

  it("preserves zero rest and zero load instead of treating them as missing", async () => {
    expect(await importExercise({ restTime: 0, weight: 0, weightUnit: "lb" })).toMatchObject({ restTime: 0, weight: 0 })
  })

  it("does not invent rest or load when the cells are blank", async () => {
    expect(await importExercise({})).toMatchObject({ notes: "", restTime: null, weight: null })
    expect(await importExercise({ restTime: -1, weight: -1, weightUnit: "kg" })).toMatchObject({ restTime: null, weight: null })
  })

  it.each([undefined, null, "", "oz", "plate"])("keeps load unset for ambiguous unit %s and preserves the source value for review", async (weightUnit) => {
    const exercise = await importExercise({ weight: 135, weightUnit, note: "Source note" })
    expect(exercise.weight).toBeNull()
    expect(exercise.notes).toContain("Source note")
    expect(exercise.notes).toContain(`Weight in image: 135${weightUnit ? ` ${weightUnit}` : ""}`)
    expect(exercise.notes).toContain("Confirm the unit")
  })

  it("shows an ambiguous load warning in the coach's language", async () => {
    const exercise = await importExercise({ weight: 100 }, "vi")
    expect(exercise.weight).toBeNull()
    expect(exercise.notes).toContain("Tạ trong ảnh: 100")
    expect(exercise.notes).toContain("Cần xác nhận đơn vị")
  })

  it("prescribes the first set's weight and notes the per-set list", async () => {
    expect(await importExercise({ sets: 2, weight: "65,50", weightUnit: "kg" })).toMatchObject({
      notes: "Weight per set: 65 / 50 kg", weight: 65,
    })
    expect(await importExercise({ sets: 2, weight: "135,95", weightUnit: "lb" })).toMatchObject({
      notes: "Weight per set: 61.23 / 43.09 kg", weight: 61.23,
    })
    // The same weight on every set needs no note.
    expect(await importExercise({ sets: 3, weight: "60,60,60", weightUnit: "kg" })).toMatchObject({ notes: "", weight: 60 })
  })

  it("reads a decimal comma as one weight", async () => {
    expect(await importExercise({ sets: 3, weight: "62,5", weightUnit: "kg" })).toMatchObject({ notes: "", weight: 62.5 })
  })

  it("keeps an unknown set scheme in the notes and a known one as methods only", async () => {
    expect(await importExercise({ setScheme: "Pyramid", sets: 3 })).toMatchObject({ notes: "Pyramid", setIntensityTags: [] })
    expect(await importExercise({ note: "Pause at the bottom", setScheme: "1 Topset-Backoffset", sets: 3 })).toMatchObject({
      notes: "Pause at the bottom",
      setIntensityTags: [
        { setNumber: 1, tag: "top_set" },
        { setNumber: 2, tag: "back_off" },
        { setNumber: 3, tag: "back_off" },
      ],
    })
  })

  it("still finds a set scheme the model wrote into the note column", async () => {
    expect(await importExercise({ note: "Topset-Backoffset", sets: 2 })).toMatchObject({
      notes: "",
      setIntensityTags: [{ setNumber: 1, tag: "top_set" }, { setNumber: 2, tag: "back_off" }],
    })
    expect(await importExercise({ note: "Slow eccentric", sets: 2 })).toMatchObject({ notes: "Slow eccentric", setIntensityTags: [] })
  })

  it("maps a top set and back-off sets written in one cell onto the back-off row", async () => {
    const scheme = { setScheme: "Topset-Backoffset", sets: 3, weightUnit: "kg" }
    // Reps only: the back-off sets keep the top set's weight.
    expect(await importExercise({ ...scheme, reps: "6-8/8-12", weight: "80" })).toMatchObject({
      backOff: { reps: "8-12", weight: 80 },
      notes: "",
      reps: "6-8",
      weight: 80,
    })
    // Weight only: the back-off sets keep the top set's reps.
    expect(await importExercise({ ...scheme, reps: "5", weight: "100,85" })).toMatchObject({
      backOff: { reps: "5", weight: 85 },
      notes: "",
    })
  })

  it("leaves cells that do not split into a top set and back-off sets in the notes", async () => {
    // No top set + back-off method: one row, and the per-set values stay noted.
    expect(await importExercise({ reps: "6-8/5-10", sets: 2, weight: "65,50", weightUnit: "kg" })).toMatchObject({
      backOff: null,
      notes: "Reps: 6-8/5-10 · Weight per set: 65 / 50 kg",
    })
    // Three loads for two roles cannot be placed: the coach sorts them out.
    expect(
      await importExercise({ reps: "6-8/5-10", setScheme: "Topset-Backoffset", sets: 3, weight: "65,55,50", weightUnit: "kg" }),
    ).toMatchObject({
      backOff: { reps: "5-10", weight: 65 },
      notes: "Weight per set: 65 / 55 / 50 kg",
    })
  })

  it("notes a weight cell it cannot read instead of dropping it", async () => {
    expect(await importExercise({ weight: "BW", weightUnit: null })).toMatchObject({ notes: "Weight in image: BW", weight: null })
  })
})
