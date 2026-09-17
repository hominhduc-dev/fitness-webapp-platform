import { describe, expect, it } from "vitest"

import { registerSchema, updateProfileSchema } from "./auth.schemas"

const minimalSignup = { email: "trainee@example.com", name: "New Trainee", password: "strong-password" }

describe("registerSchema", () => {
  it("accepts a free trainee signup without phone or username", () => {
    expect(registerSchema.parse(minimalSignup)).toEqual(minimalSignup)
  })

  it("continues accepting existing clients that send phone and username", () => {
    expect(registerSchema.safeParse({ ...minimalSignup, phone: "0912345678", username: "newtrainee" }).success).toBe(true)
  })

  it("still rejects missing core signup fields", () => {
    expect(registerSchema.safeParse({ name: minimalSignup.name, password: minimalSignup.password }).success).toBe(false)
    expect(registerSchema.safeParse({ email: minimalSignup.email, password: minimalSignup.password }).success).toBe(false)
  })
})

describe("updateProfileSchema nullable numbers", () => {
  it("keeps an explicit null as null rather than coercing it to zero", () => {
    const parsed = updateProfileSchema.parse({ dailyCalorieGoal: null, heightCm: null, targetWeightKg: null })

    expect(parsed).toEqual({ dailyCalorieGoal: null, heightCm: null, targetWeightKg: null })
  })

  it("still coerces the numeric strings older clients send", () => {
    expect(updateProfileSchema.parse({ heightCm: "175.5" })).toEqual({ heightCm: 175.5 })
  })

  it("leaves a field out when it is not part of the update", () => {
    expect(updateProfileSchema.parse({ name: "Coach Duc" })).toEqual({ name: "Coach Duc" })
  })
})
