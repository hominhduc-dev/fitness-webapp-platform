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

import { claimOAuthSignupRole, loginUser, registerUser } from "./core"

const authUser = {
  email: "coach@example.com",
  id: "00000000-0000-4000-8000-000000000001",
  user_metadata: { name: "New Coach" },
}

const session = { access_token: "access", expires_at: 1, expires_in: 2, refresh_token: "refresh", token_type: "bearer" }

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
    name: "New Coach",
    phone: null,
    preferredWeightUnit: "kg",
    role: "coach",
    sex: null,
    supabaseAuthUserId: authUser.id,
    targetWeightKg: null,
    updatedAt: new Date("2026-09-16T00:00:00.000Z"),
    username: null,
    ...overrides,
  }
}

describe("coach self-signup", () => {
  /** The row Prisma would hold; `update` merges onto it the way the database does. */
  let storedProfile: ReturnType<typeof buildProfileRow> | null = null

  function storeProfile(profile: ReturnType<typeof buildProfileRow>) {
    storedProfile = profile
    mocks.findUnique.mockResolvedValue(profile)
    mocks.findFirst.mockResolvedValue(profile)
  }

  beforeEach(() => {
    storedProfile = null
    mocks.findUnique.mockReset().mockResolvedValue(null)
    mocks.findFirst.mockReset().mockResolvedValue(null)
    mocks.update.mockReset().mockImplementation(async ({ data }) => ({ ...(storedProfile ?? buildProfileRow()), ...data }))
    mocks.create.mockReset().mockImplementation(async ({ data }) => buildProfileRow(data))
    mocks.signUp.mockReset().mockResolvedValue({ data: { session, user: authUser }, error: null })
    mocks.signInWithPassword.mockReset().mockResolvedValue({ data: { session, user: authUser }, error: null })
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: authUser }, error: null })
  })

  it("creates a coach locked and pending, and withholds the session", async () => {
    const result = await registerUser({
      email: authUser.email,
      name: "New Coach",
      password: "password123",
      role: "coach",
    })

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coachApprovalStatus: "pending", isActive: false, role: "coach" }),
      }),
    )
    expect(result.requiresApproval).toBe(true)
    // Supabase handed back a usable session; the caller must not receive it.
    expect(result.session).toBeNull()
  })

  it("leaves a trainee signup active and signed in", async () => {
    mocks.create.mockImplementation(async ({ data }) => buildProfileRow({ ...data, role: "trainee" }))

    const result = await registerUser({
      email: "trainee@example.com",
      name: "New Trainee",
      password: "password123",
      role: "trainee",
    })

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coachApprovalStatus: null, isActive: true, role: "trainee" }),
      }),
    )
    expect(result.requiresApproval).toBe(false)
    expect(result.session).not.toBeNull()
  })

  it("rejects an unapproved role, so nobody can register straight into admin", async () => {
    mocks.create.mockImplementation(async ({ data }) => buildProfileRow({ ...data, role: "trainee" }))

    await registerUser({ email: "someone@example.com", name: "Someone", password: "password123", role: "admin" })

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "trainee" }) }),
    )
  })

  it("tells a pending coach why sign-in is blocked", async () => {
    storeProfile(buildProfileRow({ coachApprovalStatus: "pending", isActive: false }))

    await expect(loginUser({ identifier: authUser.email, password: "password123" })).rejects.toThrow(
      /đang chờ quản trị viên duyệt/,
    )
  })

  it("lets an approved coach sign in", async () => {
    storeProfile(buildProfileRow({ coachApprovalStatus: "approved", isActive: true }))

    const result = await loginUser({ identifier: authUser.email, password: "password123" })

    expect(result.profile?.role).toBe("coach")
    expect(result.session).not.toBeNull()
  })

  it("keeps a rejected coach out with its own message", async () => {
    storeProfile(buildProfileRow({ coachApprovalStatus: "rejected", isActive: false }))

    await expect(loginUser({ identifier: authUser.email, password: "password123" })).rejects.toThrow(
      /chưa được duyệt/,
    )
  })
  it("claims the coach role for a Google account that has no profile yet", async () => {
    const result = await claimOAuthSignupRole("access-token", "coach")

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coachApprovalStatus: "pending", isActive: false, role: "coach" }),
      }),
    )
    expect(result.claimed).toBe(true)
    expect(result.requiresApproval).toBe(true)
  })

  it("never turns an account that already exists into a pending coach", async () => {
    storeProfile(buildProfileRow({ isActive: true, role: "trainee" }))

    const result = await claimOAuthSignupRole("access-token", "coach")

    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(result.claimed).toBe(false)
    expect(result.profile?.role).toBe("trainee")
  })
})
