import { describe, expect, it } from "vitest"

import { registerSchema } from "./auth.schemas"

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
