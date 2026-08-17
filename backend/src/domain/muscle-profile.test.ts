import { describe, expect, it } from "vitest"

import {
  buildApprovedMuscleProfileData,
  buildApprovedMuscleProfileUpdate,
  legacyMuscleGroupToSlugs,
  parseMuscleListValue,
  parseMuscleProfileInput,
  serializeMuscleProfile,
  serializePublicMuscleProfile,
} from "./muscle-profile"

describe("muscle profile validation", () => {
  it("accepts ordered primary and secondary targets", () => {
    expect(parseMuscleProfileInput({
      activityType: "strength",
      primaryMuscles: ["gluteal", "quadriceps"],
      secondaryMuscles: ["hamstring"],
    })).toEqual({
      activityType: "strength",
      primaryMuscles: ["gluteal", "quadriceps"],
      secondaryMuscles: ["hamstring"],
    })
  })

  it.each([
    { activityType: "strength", primaryMuscles: [], secondaryMuscles: [] },
    { activityType: "strength", primaryMuscles: ["chest", "chest"], secondaryMuscles: [] },
    { activityType: "strength", primaryMuscles: ["chest"], secondaryMuscles: ["chest"] },
    { activityType: "strength", primaryMuscles: ["unknown"], secondaryMuscles: [] },
  ])("rejects an invalid profile", (profile) => {
    expect(() => parseMuscleProfileInput(profile)).toThrow("Muscle profile không hợp lệ")
  })

  it("allows non-strength activities without targets", () => {
    expect(parseMuscleProfileInput({ activityType: "cardio", primaryMuscles: [], secondaryMuscles: [] }).activityType).toBe("cardio")
  })

  it("parses comma-separated import cells and includes gluteal in legacy Legs", () => {
    expect(parseMuscleListValue("chest, triceps")).toEqual(["chest", "triceps"])
    expect(legacyMuscleGroupToSlugs("Legs")).toContain("gluteal")
  })

  it("builds ordered nested writes for create and update", () => {
    const profile = parseMuscleProfileInput({ activityType: "strength", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"] })
    expect(buildApprovedMuscleProfileData(profile, "11111111-1111-4111-8111-111111111111")).toMatchObject({
      activityType: "strength",
      muscleProfileSource: "manual",
      muscleProfileStatus: "approved",
      muscleTargets: { create: [
        { muscleSlug: "chest", position: 0, role: "primary" },
        { muscleSlug: "triceps", position: 0, role: "secondary" },
      ] },
    })
    expect(buildApprovedMuscleProfileUpdate(profile).muscleTargets).toMatchObject({ deleteMany: {} })
  })

  it("keeps review metadata admin-only and resolves pending profiles publicly through legacy targets", () => {
    const record = {
      activityType: "strength" as const,
      muscleProfileConfidence: 0.72,
      muscleProfileRationale: "Needs review",
      muscleProfileSource: "ai" as const,
      muscleProfileStatus: "pending" as const,
      muscleTargets: [{ muscleSlug: "tibialis", position: 0, role: "primary" as const }],
    }
    expect(serializeMuscleProfile(record)).toMatchObject({ muscleProfileConfidence: 0.72, muscleProfileStatus: "pending" })
    const publicProfile = serializePublicMuscleProfile(record, "Legs")
    expect(publicProfile.primaryMuscles).toContain("gluteal")
    expect(publicProfile).not.toHaveProperty("muscleProfileConfidence")
    expect(publicProfile).not.toHaveProperty("muscleProfileStatus")
  })
})
