import { Prisma, UserRole, WeightUnit, type User as AppUser } from "@prisma/client"
import type { Session, User as SupabaseUser } from "@supabase/supabase-js"

import { env } from "../../config/env"
import { prisma } from "../../lib/prisma"
import { supabaseAdmin, supabasePublic } from "../../lib/supabase"
import { AuthServiceError } from "../errors"

type SerializableSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  expiresIn: number | null
  tokenType: string
}

type AuthUserPayload = {
  id: string
  email: string | null
}

type AuthResult = {
  message?: string
  profile: ReturnType<typeof serializeProfile> | null
  requiresEmailConfirmation?: boolean
  session: SerializableSession | null
  user: AuthUserPayload | null
}

type SerializedProfile = NonNullable<ReturnType<typeof serializeProfile>>

type AuthenticatedProfileContext = {
  authUser: SupabaseUser
  profile: SerializedProfile
}

type ProfileUpdateInput = {
  avatar?: string | null
  dailyCalorieGoal?: number | null
  fitnessGoals?: string[]
  heightCm?: number | null
  name?: string | null
  phone?: string | null
  preferredWeightUnit?: string | null
  targetWeightKg?: number | null
}

const USERNAME_PATTERN = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/
const DEFAULT_DAILY_CALORIE_GOAL = 2500
const MIN_DAILY_CALORIE_GOAL = 500
const MAX_DAILY_CALORIE_GOAL = 10000
const MIN_HEIGHT_CM = 50
const MAX_HEIGHT_CM = 300
const MIN_TARGET_WEIGHT_KG = 20
const MAX_TARGET_WEIGHT_KG = 500
const AVATAR_BUCKET = "avatars"
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024
const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

type SupportedAvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number]

const AVATAR_EXTENSION_BY_CONTENT_TYPE: Record<SupportedAvatarContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function fallbackNameFromEmail(email?: string | null) {
  if (!email) {
    return "YeahBuddy User"
  }

  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || email
}

function normalizeRole(role?: string | null) {
  switch (role) {
    case UserRole.admin:
      return UserRole.admin
    case UserRole.coach:
      return UserRole.coach
    default:
      return UserRole.trainee
  }
}

function normalizePublicRole(role?: string | null) {
  return role === UserRole.coach ? UserRole.coach : UserRole.trainee
}

function isSupportedAvatarContentType(value: string): value is SupportedAvatarContentType {
  return AVATAR_CONTENT_TYPES.includes(value as SupportedAvatarContentType)
}

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseAvatarDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i)

  if (!match) {
    throw new AuthServiceError("Ảnh đại diện không hợp lệ.")
  }

  const contentType = match[1].toLowerCase()

  if (!isSupportedAvatarContentType(contentType)) {
    throw new AuthServiceError("Ảnh đại diện phải là JPG, PNG hoặc WebP.")
  }

  const buffer = Buffer.from(match[2], "base64")

  if (!buffer.byteLength) {
    throw new AuthServiceError("Ảnh đại diện không hợp lệ.")
  }

  if (buffer.byteLength > MAX_AVATAR_FILE_SIZE_BYTES) {
    throw new AuthServiceError("Ảnh đại diện không được vượt quá 2MB.")
  }

  return {
    buffer,
    contentType,
    extension: AVATAR_EXTENSION_BY_CONTENT_TYPE[contentType],
  }
}

function createAvatarObjectPath(userId: string, contentType: SupportedAvatarContentType) {
  const extension = AVATAR_EXTENSION_BY_CONTENT_TYPE[contentType]
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `profiles/${userId}/${uniqueSuffix}.${extension}`
}

function extractManagedAvatarPath(url?: string | null) {
  if (!url) {
    return null
  }

  try {
    const pathname = new URL(url).pathname
    const publicPrefix = `/storage/v1/object/public/${AVATAR_BUCKET}/`
    const prefixIndex = pathname.indexOf(publicPrefix)

    if (prefixIndex === -1) {
      return null
    }

    const objectPath = pathname.slice(prefixIndex + publicPrefix.length)
    return objectPath || null
  } catch {
    return null
  }
}

async function ensureAvatarBucket() {
  if (!supabaseAdmin) {
    throw new AuthServiceError("Supabase Storage chưa được cấu hình.", 500)
  }

  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(AVATAR_BUCKET)

  if (bucketError) {
    const normalizedMessage = bucketError.message.toLowerCase()

    if (normalizedMessage.includes("not found") || normalizedMessage.includes("does not exist")) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(AVATAR_BUCKET, {
        allowedMimeTypes: [...AVATAR_CONTENT_TYPES],
        fileSizeLimit: MAX_AVATAR_FILE_SIZE_BYTES,
        public: true,
      })

      if (createError && !createError.message.toLowerCase().includes("already exists")) {
        throw new AuthServiceError(createError.message, 400)
      }

      return
    }

    throw new AuthServiceError(bucketError.message, 400)
  }

  if (!bucket.public) {
    const { error: updateError } = await supabaseAdmin.storage.updateBucket(AVATAR_BUCKET, {
      allowedMimeTypes: [...AVATAR_CONTENT_TYPES],
      fileSizeLimit: MAX_AVATAR_FILE_SIZE_BYTES,
      public: true,
    })

    if (updateError) {
      throw new AuthServiceError(updateError.message, 400)
    }
  }
}

async function removeAvatarObject(objectPath?: string | null) {
  if (!supabaseAdmin || !objectPath) {
    return
  }

  await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([objectPath])
}

function normalizeFitnessGoals(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((goal) => String(goal).trim()).filter(Boolean)
}

function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || undefined
}

function normalizeUsername(value?: string | null) {
  const trimmed = value?.trim().toLowerCase()

  if (!trimmed) {
    return undefined
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new AuthServiceError(
      "Username chỉ được chứa chữ thường, số, dấu chấm hoặc gạch dưới, dài từ 3 đến 30 ký tự.",
    )
  }

  return trimmed
}

function normalizePhoneNumber(value?: string | null) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.replace(/[^\d+]/g, "")

  if (normalized.startsWith("+")) {
    const digits = normalized.slice(1).replace(/\D/g, "")

    if (digits.length < 8 || digits.length > 15) {
      throw new AuthServiceError("Số điện thoại không hợp lệ.")
    }

    return `+${digits}`
  }

  const digitsOnly = normalized.replace(/\D/g, "")

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    throw new AuthServiceError("Số điện thoại không hợp lệ.")
  }

  if (digitsOnly.startsWith("0")) {
    return `+84${digitsOnly.slice(1)}`
  }

  if (digitsOnly.startsWith("84")) {
    return `+${digitsOnly}`
  }

  return `+${digitsOnly}`
}

function normalizeWeightUnit(value?: string | null) {
  if (!value) {
    return WeightUnit.kg
  }

  if (value === WeightUnit.kg || value === WeightUnit.lbs) {
    return value
  }

  throw new AuthServiceError("Đơn vị cân nặng không hợp lệ.")
}

function normalizeDailyCalorieGoal(value?: number | null) {
  if (value == null) {
    return DEFAULT_DAILY_CALORIE_GOAL
  }

  if (!Number.isFinite(value)) {
    throw new AuthServiceError("Mục tiêu calories mỗi ngày không hợp lệ.")
  }

  const rounded = Math.round(value)

  if (rounded < MIN_DAILY_CALORIE_GOAL || rounded > MAX_DAILY_CALORIE_GOAL) {
    throw new AuthServiceError(
      `Mục tiêu calories mỗi ngày phải nằm trong khoảng ${MIN_DAILY_CALORIE_GOAL}-${MAX_DAILY_CALORIE_GOAL}.`,
    )
  }

  return rounded
}

function roundMetric(value: number, fractionDigits = 1) {
  return Number(value.toFixed(fractionDigits))
}

function parseOptionalFiniteNumber(value: unknown) {
  if (value == null || value === "") {
    return undefined
  }

  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeHeightCm(value?: number | null) {
  if (value == null) {
    return null
  }

  if (!Number.isFinite(value)) {
    throw new AuthServiceError("Chiều cao không hợp lệ.")
  }

  if (value < MIN_HEIGHT_CM || value > MAX_HEIGHT_CM) {
    throw new AuthServiceError(`Chiều cao phải nằm trong khoảng ${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM} cm.`)
  }

  return roundMetric(value, 1)
}

function normalizeTargetWeightKg(value?: number | null) {
  if (value == null) {
    return null
  }

  if (!Number.isFinite(value)) {
    throw new AuthServiceError("Mục tiêu cân nặng không hợp lệ.")
  }

  if (value < MIN_TARGET_WEIGHT_KG || value > MAX_TARGET_WEIGHT_KG) {
    throw new AuthServiceError(
      `Mục tiêu cân nặng phải nằm trong khoảng ${MIN_TARGET_WEIGHT_KG}-${MAX_TARGET_WEIGHT_KG} kg.`,
    )
  }

  return roundMetric(value, 2)
}

function parseMetadataHeightCm(value: unknown) {
  const parsed = parseOptionalFiniteNumber(value)

  if (parsed == null || parsed < MIN_HEIGHT_CM || parsed > MAX_HEIGHT_CM) {
    return undefined
  }

  return roundMetric(parsed, 1)
}

function parseMetadataTargetWeightKg(value: unknown) {
  const parsed = parseOptionalFiniteNumber(value)

  if (parsed == null || parsed < MIN_TARGET_WEIGHT_KG || parsed > MAX_TARGET_WEIGHT_KG) {
    return undefined
  }

  return roundMetric(parsed, 2)
}

function looksLikeEmail(value: string) {
  return value.includes("@")
}

function looksLikePhone(value: string) {
  return /^[+\d][\d\s().-]{7,}$/.test(value.trim())
}

function resolveUserName(authUser: SupabaseUser, nameOverride?: string | null) {
  if (sanitizeText(nameOverride)) {
    return sanitizeText(nameOverride) as string
  }

  const metadata = authUser.user_metadata

  return (
    sanitizeText(metadata?.name) ??
    sanitizeText(metadata?.full_name) ??
    sanitizeText(metadata?.display_name) ??
    fallbackNameFromEmail(authUser.email)
  )
}

function resolveUserAvatar(authUser: SupabaseUser, avatarOverride?: string | null) {
  if (sanitizeText(avatarOverride)) {
    return sanitizeText(avatarOverride)
  }

  const metadata = authUser.user_metadata
  return sanitizeText(metadata?.avatar_url) ?? sanitizeText(metadata?.picture)
}

function resolveUserUsername(authUser: SupabaseUser, usernameOverride?: string | null) {
  const metadataUsername =
    typeof authUser.user_metadata?.username === "string" ? authUser.user_metadata.username : undefined

  return normalizeUsername(usernameOverride ?? metadataUsername)
}

function resolveUserPhone(authUser: SupabaseUser, phoneOverride?: string | null) {
  const metadataPhone = typeof authUser.user_metadata?.phone === "string" ? authUser.user_metadata.phone : undefined
  return normalizePhoneNumber(phoneOverride ?? authUser.phone ?? metadataPhone)
}

function resolveUserRole(authUser: SupabaseUser, roleOverride?: string | null) {
  const metadataRole =
    typeof authUser.user_metadata?.role === "string" ? authUser.user_metadata.role : undefined

  return normalizeRole(roleOverride ?? metadataRole)
}

function ensureAuthClient() {
  if (!supabasePublic) {
    throw new AuthServiceError("Supabase Auth is not configured on the backend.", 500)
  }

  return supabasePublic
}

function serializeSession(session: Session | null): SerializableSession | null {
  if (!session) {
    return null
  }

  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    refreshToken: session.refresh_token,
    tokenType: session.token_type,
  }
}

function serializeAuthUser(user: SupabaseUser | null): AuthUserPayload | null {
  if (!user) {
    return null
  }

  return {
    email: user.email ?? null,
    id: user.id,
  }
}

function serializeProfile(profile: AppUser | null) {
  if (!profile) {
    return null
  }

  return {
    avatar: profile.avatar,
    coachId: profile.coachId,
    createdAt: profile.createdAt,
    dailyCalorieGoal: profile.dailyCalorieGoal,
    email: profile.email,
    fitnessGoals: profile.fitnessGoals,
    heightCm: profile.heightCm,
    id: profile.id,
    isActive: profile.isActive,
    name: profile.name,
    phone: profile.phone,
    preferredWeightUnit: profile.preferredWeightUnit,
    role: profile.role,
    supabaseAuthUserId: profile.supabaseAuthUserId,
    targetWeightKg: profile.targetWeightKg,
    updatedAt: profile.updatedAt,
    username: profile.username,
  }
}

function getRegistrationRedirectUrl(redirectTo?: string) {
  return redirectTo ?? `${env.frontendUrl}/auth/callback`
}

function getPasswordResetRedirectUrl(redirectTo?: string) {
  return redirectTo ?? `${env.frontendUrl}/auth/callback?next=/reset-password`
}

function getPasswordResetSuccessResult() {
  return {
    message: "Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.",
    profile: null,
    session: null,
    user: null,
  } satisfies AuthResult
}

function assertProfileIsActive(profile: Pick<AppUser, "isActive">) {
  if (!profile.isActive) {
    throw new AuthServiceError("Tài khoản này đã bị khoá. Vui lòng liên hệ quản trị viên.", 403)
  }
}

async function syncProfile(authUser: SupabaseUser, overrides?: {
  avatar?: string | null
  name?: string | null
  phone?: string | null
  role?: string | null
  username?: string | null
}) {
  if (!prisma || !authUser.email) {
    return null
  }

  const email = normalizeEmail(authUser.email) as string
  const username = resolveUserUsername(authUser, overrides?.username)
  const phone = resolveUserPhone(authUser, overrides?.phone)
  const lookupConditions: Prisma.UserWhereInput[] = [{ supabaseAuthUserId: authUser.id }]

  if (email) {
    lookupConditions.push({ email })
  }

  if (phone) {
    lookupConditions.push({ phone })
  }

  if (username) {
    lookupConditions.push({ username })
  }

  const existingProfile = await prisma.user.findFirst({
    where: {
      OR: lookupConditions,
    },
  })

  const name = resolveUserName(authUser, overrides?.name)
  const avatar = resolveUserAvatar(authUser, overrides?.avatar)
  const metadataGoals = normalizeFitnessGoals(authUser.user_metadata?.fitnessGoals)
  const metadataHeightCm = parseMetadataHeightCm(authUser.user_metadata?.heightCm)
  const metadataTargetWeightKg = parseMetadataTargetWeightKg(authUser.user_metadata?.targetWeightKg)
  const nextRole = existingProfile?.role ?? resolveUserRole(authUser, overrides?.role)

  if (existingProfile) {
    return prisma.user.update({
      data: {
        avatar: avatar ?? existingProfile.avatar,
        dailyCalorieGoal: existingProfile.dailyCalorieGoal,
        email,
        fitnessGoals: existingProfile.fitnessGoals.length > 0 ? existingProfile.fitnessGoals : metadataGoals,
        heightCm: existingProfile.heightCm ?? metadataHeightCm,
        name,
        phone: phone ?? existingProfile.phone,
        preferredWeightUnit: existingProfile.preferredWeightUnit,
        role: nextRole,
        supabaseAuthUserId: authUser.id,
        targetWeightKg: existingProfile.targetWeightKg ?? metadataTargetWeightKg,
        username: username ?? existingProfile.username,
      },
      where: {
        id: existingProfile.id,
      },
    })
  }

  return prisma.user.create({
    data: {
      avatar,
      email,
      fitnessGoals: metadataGoals,
      heightCm: metadataHeightCm,
      name,
      phone,
      role: nextRole,
      supabaseAuthUserId: authUser.id,
      targetWeightKg: metadataTargetWeightKg,
      username,
    },
  })
}

async function findUserByIdentifier(identifier: string) {
  const db = prisma
  const trimmedIdentifier = identifier.trim()

  if (!db || !trimmedIdentifier) {
    return null
  }

  if (looksLikeEmail(trimmedIdentifier)) {
    const email = normalizeEmail(trimmedIdentifier)

    if (!email) {
      return null
    }

    return db.user.findUnique({
      where: {
        email,
      },
    })
  }

  if (looksLikePhone(trimmedIdentifier)) {
    const phone = normalizePhoneNumber(trimmedIdentifier)

    if (!phone) {
      return null
    }

    return db.user.findUnique({
      where: {
        phone,
      },
    })
  }

  const username = normalizeUsername(trimmedIdentifier)

  if (!username) {
    return null
  }

  return db.user.findUnique({
    where: {
      username,
    },
  })
}

async function resolveLoginEmail(identifier: string) {
  const trimmedIdentifier = identifier.trim()

  if (!trimmedIdentifier) {
    throw new AuthServiceError("Vui lòng nhập email, số điện thoại hoặc username.")
  }

  if (looksLikeEmail(trimmedIdentifier)) {
    return normalizeEmail(trimmedIdentifier) as string
  }

  const profile = await findUserByIdentifier(trimmedIdentifier)

  if (!profile?.email) {
    throw new AuthServiceError("Tài khoản hoặc mật khẩu không chính xác.", 401)
  }

  return profile.email
}

async function ensureRegistrationIdentifiersAvailable(input: { email: string; phone: string; username: string }) {
  if (!prisma) {
    return
  }

  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  })

  if (existingByEmail) {
    throw new AuthServiceError("Email này đã được sử dụng.")
  }

  const existingByUsername = await prisma.user.findUnique({
    where: {
      username: input.username,
    },
  })

  if (existingByUsername) {
    throw new AuthServiceError("Username này đã được sử dụng.")
  }

  const existingByPhone = await prisma.user.findUnique({
    where: {
      phone: input.phone,
    },
  })

  if (existingByPhone) {
    throw new AuthServiceError("Số điện thoại này đã được sử dụng.")
  }
}

async function getVerifiedUser(accessToken: string) {
  const client = supabaseAdmin ?? ensureAuthClient()
  const { data, error } = await client.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new AuthServiceError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", 401)
  }

  return data.user
}

async function registerUser(input: {
  email: string
  name: string
  password: string
  phone: string
  redirectTo?: string
  role?: string | null
  username: string
}) {
  const client = ensureAuthClient()
  const email = normalizeEmail(input.email) as string
  const password = input.password.trim()
  const name = input.name.trim()
  const phone = normalizePhoneNumber(input.phone)
  const username = normalizeUsername(input.username)

  if (!email || !password || !name || !phone || !username) {
    throw new AuthServiceError("Vui lòng điền đầy đủ họ tên, email, username, số điện thoại và mật khẩu.")
  }

  if (password.length < 6) {
    throw new AuthServiceError("Mật khẩu phải có ít nhất 6 ký tự.")
  }

  await ensureRegistrationIdentifiersAvailable({
    email,
    phone,
    username,
  })

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        role: normalizePublicRole(input.role),
        username,
      },
      emailRedirectTo: getRegistrationRedirectUrl(input.redirectTo),
    },
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  const profile = data.user
    ? await syncProfile(data.user, { name, phone, role: normalizePublicRole(input.role), username })
    : null
  const requiresEmailConfirmation = !data.session

  return {
    message: requiresEmailConfirmation
      ? "Tài khoản đã được tạo. Vui lòng xác nhận email để hoàn tất đăng nhập."
      : "Đăng ký thành công.",
    profile: serializeProfile(profile),
    requiresEmailConfirmation,
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function loginUser(input: { identifier: string; password: string }) {
  const client = ensureAuthClient()
  const email = await resolveLoginEmail(input.identifier)

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  })

  if (error || !data.user) {
    throw new AuthServiceError(error?.message ?? "Không thể đăng nhập.", 401)
  }

  const profile = await syncProfile(data.user)

  if (profile) {
    assertProfileIsActive(profile)
  }

  return {
    message: "Đăng nhập thành công.",
    profile: serializeProfile(profile),
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function refreshAuthSession(input: { accessToken?: string; refreshToken: string }) {
  const client = ensureAuthClient()

  const { data, error } = await client.auth.refreshSession({
    refresh_token: input.refreshToken,
  })

  if (error || !data.user) {
    throw new AuthServiceError(error?.message ?? "Không thể làm mới phiên đăng nhập.", 401)
  }

  const profile = await syncProfile(data.user)

  if (profile) {
    assertProfileIsActive(profile)
  }

  return {
    message: "Phiên đăng nhập đã được làm mới.",
    profile: serializeProfile(profile),
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function getCurrentProfile(accessToken: string) {
  const user = await getVerifiedUser(accessToken)
  const profile = await syncProfile(user)

  if (profile) {
    assertProfileIsActive(profile)
  }

  return {
    profile: serializeProfile(profile),
    session: null,
    user: serializeAuthUser(user),
  } satisfies AuthResult
}

async function requireCurrentProfile(accessToken: string): Promise<AuthenticatedProfileContext> {
  const authUser = await getVerifiedUser(accessToken)
  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  assertProfileIsActive(profile)

  return {
    authUser,
    profile: serializeProfile(profile) as SerializedProfile,
  }
}

async function applyProfileUpdates(authUser: SupabaseUser, profile: AppUser, updates: ProfileUpdateInput) {
  const db = prisma

  if (!db) {
    throw new AuthServiceError("Database is not configured for profile updates.", 500)
  }

  const nextName = sanitizeText(updates.name) ?? profile.name
  let nextAvatar = profile.avatar

  if (updates.avatar !== undefined) {
    nextAvatar = updates.avatar === null || updates.avatar.trim() === "" ? null : sanitizeText(updates.avatar) ?? null
  }

  const nextGoals = Array.isArray(updates.fitnessGoals)
    ? updates.fitnessGoals.map((goal) => goal.trim()).filter(Boolean)
    : profile.fitnessGoals
  const hasPhoneUpdate = updates.phone !== undefined
  const hasDailyCalorieGoalUpdate = updates.dailyCalorieGoal !== undefined
  const hasHeightUpdate = updates.heightCm !== undefined
  const hasWeightUnitUpdate = updates.preferredWeightUnit !== undefined
  const hasTargetWeightUpdate = updates.targetWeightKg !== undefined
  const nextPhone = hasPhoneUpdate
    ? updates.phone === null || updates.phone?.trim() === ""
      ? null
      : normalizePhoneNumber(updates.phone)
    : profile.phone
  const nextDailyCalorieGoal = hasDailyCalorieGoalUpdate
    ? normalizeDailyCalorieGoal(updates.dailyCalorieGoal)
    : profile.dailyCalorieGoal
  const nextHeightCm = hasHeightUpdate ? normalizeHeightCm(updates.heightCm) : profile.heightCm
  const nextWeightUnit = hasWeightUnitUpdate
    ? normalizeWeightUnit(updates.preferredWeightUnit)
    : profile.preferredWeightUnit
  const nextTargetWeightKg = hasTargetWeightUpdate
    ? normalizeTargetWeightKg(updates.targetWeightKg)
    : profile.targetWeightKg

  if (nextPhone) {
    const existingPhoneOwner = await db.user.findFirst({
      select: {
        id: true,
      },
      where: {
        id: {
          not: profile.id,
        },
        phone: nextPhone,
      },
    })

    if (existingPhoneOwner) {
      throw new AuthServiceError("Số điện thoại này đã được sử dụng.")
    }
  }

  const updatedProfile = await db.user.update({
    data: {
      avatar: nextAvatar,
      dailyCalorieGoal: nextDailyCalorieGoal,
      fitnessGoals: nextGoals,
      heightCm: nextHeightCm,
      name: nextName,
      phone: nextPhone,
      preferredWeightUnit: nextWeightUnit,
      targetWeightKg: nextTargetWeightKg,
    },
    where: {
      id: profile.id,
    },
  })

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        avatar_url: nextAvatar ?? undefined,
        dailyCalorieGoal: nextDailyCalorieGoal,
        fitnessGoals: nextGoals,
        full_name: nextName,
        heightCm: nextHeightCm,
        name: nextName,
        phone: nextPhone ?? undefined,
        preferredWeightUnit: nextWeightUnit,
        targetWeightKg: nextTargetWeightKg,
      },
    })

    if (error != null) {
      throw new AuthServiceError(error.message, 400)
    }
  }

  return updatedProfile
}

async function updateCurrentProfile(accessToken: string, updates: ProfileUpdateInput) {
  const authUser = await getVerifiedUser(accessToken)

  if (!prisma || !authUser.email) {
    throw new AuthServiceError("Database is not configured for profile updates.", 500)
  }

  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  const updatedProfile = await applyProfileUpdates(authUser, profile, updates)

  return {
    message: "Hồ sơ đã được cập nhật.",
    profile: serializeProfile(updatedProfile),
    session: null,
    user: serializeAuthUser(authUser),
  } satisfies AuthResult
}

async function uploadCurrentProfileAvatar(
  accessToken: string,
  input: {
    dataUrl: string
    fileName?: string | null
  },
) {
  const authUser = await getVerifiedUser(accessToken)

  if (!prisma || !authUser.email) {
    throw new AuthServiceError("Database is not configured for avatar uploads.", 500)
  }

  if (!supabaseAdmin) {
    throw new AuthServiceError("Supabase Storage chưa được cấu hình.", 500)
  }

  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  await ensureAvatarBucket()

  const { buffer, contentType } = parseAvatarDataUrl(input.dataUrl)
  const objectPath = createAvatarObjectPath(profile.id, contentType)
  const previousAvatarPath = extractManagedAvatarPath(profile.avatar)
  const bucket = supabaseAdmin.storage.from(AVATAR_BUCKET)

  const { error: uploadError } = await bucket.upload(objectPath, buffer, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  })

  if (uploadError) {
    throw new AuthServiceError(uploadError.message, 400)
  }

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(objectPath)

  try {
    const updatedProfile = await applyProfileUpdates(authUser, profile, {
      avatar: publicUrl,
    })

    if (previousAvatarPath && previousAvatarPath !== objectPath) {
      void removeAvatarObject(previousAvatarPath)
    }

    return {
      message: "Ảnh đại diện đã được cập nhật.",
      profile: serializeProfile(updatedProfile),
      session: null,
      user: serializeAuthUser(authUser),
    } satisfies AuthResult
  } catch (error) {
    await removeAvatarObject(objectPath)
    throw error
  }
}

async function requestPasswordReset(input: { email: string; redirectTo?: string }) {
  let email: string

  try {
    email = await resolveLoginEmail(input.email)
  } catch (error) {
    if (error instanceof AuthServiceError && error.status === 401) {
      return getPasswordResetSuccessResult()
    }

    throw error
  }

  const redirectTo = getPasswordResetRedirectUrl(input.redirectTo)
  const client = ensureAuthClient()

  async function sendWithSupabase() {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      throw new AuthServiceError(error.message, 400)
    }

    return getPasswordResetSuccessResult()
  }

  return sendWithSupabase()
}

async function logoutCurrentSession(accessToken: string) {
  await getVerifiedUser(accessToken)

  return {
    message: "Đăng xuất thiết bị hiện tại thành công.",
    profile: null,
    session: null,
    user: null,
  } satisfies AuthResult
}

export {
  AuthServiceError,
  getCurrentProfile,
  loginUser,
  logoutCurrentSession,
  refreshAuthSession,
  registerUser,
  requireCurrentProfile,
  requestPasswordReset,
  type AuthenticatedProfileContext,
  type SerializedProfile,
  uploadCurrentProfileAvatar,
  updateCurrentProfile,
}
