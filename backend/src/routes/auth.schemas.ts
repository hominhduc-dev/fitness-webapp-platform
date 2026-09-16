import { z } from "zod"

/**
 * Request schemas for `/api/auth/*`.
 *
 * Scope note: these enforce *shape and size* only. Business rules — password
 * strength, the username pattern, calorie/height bounds — stay in
 * `services/auth/core.ts`, which already rejects them with localized Vietnamese
 * messages that the UI surfaces directly. Duplicating them here would replace
 * those messages with generic ones.
 */

const email = z.string().trim().max(320)
const password = z.string().max(200)
const redirectTo = z.string().url().max(2048).optional()

const registerSchema = z.object({
  email,
  name: z.string().trim().max(120),
  password,
  phone: z.string().trim().max(32).optional(),
  redirectTo,
  role: z.string().max(32).nullish(),
  username: z.string().trim().max(60).optional(),
})

/** The callback tells us which signup the OAuth round-trip started from. */
const claimOAuthRoleSchema = z.object({
  role: z.enum(["trainee", "coach"]),
})

const loginSchema = z
  .object({
    email: email.optional(),
    identifier: z.string().trim().max(320).optional(),
    password,
  })
  // The web client sends `identifier`; older callers send `email`.
  .transform((value) => ({ identifier: value.identifier || value.email || "", password: value.password }))

const refreshSchema = z.object({
  accessToken: z.string().max(4096).optional(),
  refreshToken: z.string().max(4096),
})

const forgotPasswordSchema = z
  .object({
    email: email.optional(),
    identifier: z.string().trim().max(320).optional(),
    redirectTo,
  })
  .transform((value) => ({ email: value.identifier || value.email || "", redirectTo: value.redirectTo }))

const avatarSchema = z.object({
  // Base64 data URLs are large by nature; the express.json 5 MB limit is the outer bound.
  dataUrl: z.string().max(6_000_000),
  fileName: z.string().max(255).nullish(),
})

const nullableNumber = z.union([z.coerce.number(), z.null()]).optional()
const nullableString = z.union([z.string(), z.null()]).optional()

const updateProfileSchema = z.object({
  activityLevel: nullableString,
  avatar: nullableString,
  birthDate: nullableString,
  dailyCalorieGoal: nullableNumber,
  dietType: z.union([z.enum(["vegetarian", "pescatarian"]), z.null()]).optional(),
  fitnessGoals: z.array(z.string().max(120)).max(20).optional(),
  foodAllergies: z.array(z.string().trim().max(60)).max(20).optional(),
  heightCm: nullableNumber,
  name: nullableString,
  phone: nullableString,
  preferredWeightUnit: nullableString,
  sex: nullableString,
  targetWeightKg: nullableNumber,
  username: nullableString,
})

export {
  avatarSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  claimOAuthRoleSchema,
  registerSchema,
  updateProfileSchema,
}
