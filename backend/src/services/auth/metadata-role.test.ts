import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  update: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      create: mocks.create,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}))
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: null,
  supabasePublic: {
    auth: { getUser: mocks.getUser, signInWithPassword: mocks.signInWithPassword, signUp: mocks.signUp },
  },
}))

import { requireCurrentProfile } from "./core"

const authUser = {
  email: "direct-signup@example.com",
  id: "00000000-0000-4000-8000-000000000001",
  user_metadata: { name: "Direct Signup" },
}

function buildProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    activityLevel: null,
    avatar: null,
    birthDate: null,
    coachApprovalDecidedAt: null,
    coachApprovalStatus: null,
    coachId: null,
    createdAt: new Date("2026-09-16T00:00:00.000Z"),
    dailyCalorieGoal: 2500,
    dailyCarbsGoal: 280,
    dailyFatGoal: 70,
    dailyProteinGoal: 140,
    dietType: null,
    email: authUser.email,
    fitnessGoals: [],
    foodAllergies: [],
    goalStartWeightKg: null,
    heightCm: null,
    id: "00000000-0000-4000-8000-0000000000ff",
    isActive: true,
    name: "Direct Signup",
    phone: null,
    preferredWeightUnit: "kg",
    role: "trainee",
    sex: null,
    supabaseAuthUserId: authUser.id,
    targetWeightKg: null,
    updatedAt: new Date("2026-09-16T00:00:00.000Z"),
    username: null,
    ...overrides,
  }
}

/**
 * A user can sign up against Supabase directly with the public key, skipping
 * registerUser, and set any `user_metadata` they like. Their first request to
 * the backend then creates their profile from that metadata.
 */
describe("first sign-in of a user who signed up directly against Supabase", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue(null)
    mocks.findFirst.mockReset().mockResolvedValue(null)
    mocks.create.mockReset().mockImplementation(async ({ data }) => buildProfileRow(data))
    mocks.update.mockReset().mockImplementation(async ({ data }) => buildProfileRow({ role: "admin", ...data }))
  })

  function signedUpWith(metadata: Record<string, unknown>) {
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { ...authUser, user_metadata: { ...authUser.user_metadata, ...metadata } } },
      error: null,
    })
  }

  it("never creates an admin from self-written metadata", async () => {
    signedUpWith({ role: "admin" })

    const { profile } = await requireCurrentProfile("token-admin-metadata")

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "trainee" }) }),
    )
    expect(profile.role).toBe("trainee")
  })

  it("still lets metadata ask for coach, which stays locked pending approval", async () => {
    signedUpWith({ role: "coach" })

    await expect(requireCurrentProfile("token-coach-metadata")).rejects.toThrow()

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coachApprovalStatus: "pending", isActive: false, role: "coach" }),
      }),
    )
  })

  it("keeps an existing admin an admin, since the stored role wins over metadata", async () => {
    signedUpWith({ role: "trainee" })
    const admin = buildProfileRow({ role: "admin" })
    mocks.findUnique.mockResolvedValue(admin)
    mocks.findFirst.mockResolvedValue(admin)

    const { profile } = await requireCurrentProfile("token-existing-admin")

    expect(profile.role).toBe("admin")
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
