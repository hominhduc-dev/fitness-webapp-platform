import { describe, expect, it } from "vitest"

import { buildMuscleProfileHighlights, resolveMuscleProfile } from "./muscle-map"

describe("variation muscle-map profiles", () => {
  it("renders primary over secondary regardless of aggregation order", () => {
    const highlights = buildMuscleProfileHighlights([
      { muscleProfileStatus: "approved", primaryMuscles: ["gluteal"], secondaryMuscles: ["tibialis"] },
      { muscleProfileStatus: "approved", primaryMuscles: ["tibialis"], secondaryMuscles: ["gluteal"] },
    ], "primary", "secondary")
    expect(highlights.gluteal).toBe("primary")
    expect(highlights.tibialis).toBe("primary")
  })

  it("uses exact gluteal/tibialis targets for approved profiles", () => {
    expect(resolveMuscleProfile({
      activityType: "mobility",
      muscleGroup: "Other",
      muscleProfileStatus: "approved",
      primaryMuscles: ["tibialis"],
      secondaryMuscles: ["gluteal"],
    })).toMatchObject({ primaryMuscles: ["tibialis"], secondaryMuscles: ["gluteal"], usesLegacyFallback: false })
  })

  it("falls back for legacy logs and includes gluteal for Legs", () => {
    expect(resolveMuscleProfile({ muscleGroup: "Legs", muscleProfileStatus: "pending" })).toMatchObject({
      primaryMuscles: expect.arrayContaining(["quadriceps", "hamstring", "gluteal"]),
      secondaryMuscles: [],
      usesLegacyFallback: true,
    })
  })

  it("falls back when legacy workout payloads include empty target arrays", () => {
    expect(resolveMuscleProfile({
      muscleGroup: "Chest",
      primaryMuscles: [],
      secondaryMuscles: [],
    })).toMatchObject({
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      usesLegacyFallback: true,
    })
  })
})
