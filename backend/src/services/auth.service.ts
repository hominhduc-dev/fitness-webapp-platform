import { Prisma, UserRole, type User as AppUser } from "@prisma/client"
import type { Session, User as SupabaseUser } from "@supabase/supabase-js"

import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { supabaseAdmin, supabasePublic } from "../lib/supabase"

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

class AuthServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AuthServiceError"
    this.status = status
  }
}

const USERNAME_PATTERN = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

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

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
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

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new AuthServiceError("Supabase admin client is not configured.", 500)
  }

  return supabaseAdmin
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
    email: profile.email,
    fitnessGoals: profile.fitnessGoals,
    id: profile.id,
    name: profile.name,
    phone: profile.phone,
    role: profile.role,
    supabaseAuthUserId: profile.supabaseAuthUserId,
    updatedAt: profile.updatedAt,
    username: profile.username,
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
  const nextRole = existingProfile?.role ?? resolveUserRole(authUser, overrides?.role)

  if (existingProfile) {
    return prisma.user.update({
      data: {
        avatar: avatar ?? existingProfile.avatar,
        email,
        fitnessGoals: existingProfile.fitnessGoals.length > 0 ? existingProfile.fitnessGoals : metadataGoals,
        name,
        phone: phone ?? existingProfile.phone,
        role: nextRole,
        supabaseAuthUserId: authUser.id,
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
      name,
      phone,
      role: nextRole,
      supabaseAuthUserId: authUser.id,
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
      emailRedirectTo: input.redirectTo ?? `${env.frontendUrl}/auth/callback`,
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

  return {
    authUser,
    profile: serializeProfile(profile) as SerializedProfile,
  }
}

async function updateCurrentProfile(
  accessToken: string,
  updates: {
    avatar?: string | null
    fitnessGoals?: string[]
    name?: string | null
  },
) {
  const authUser = await getVerifiedUser(accessToken)

  if (!prisma || !authUser.email) {
    throw new AuthServiceError("Database is not configured for profile updates.", 500)
  }

  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  const nextName = sanitizeText(updates.name) ?? profile.name
  const nextAvatar = updates.avatar === "" ? null : sanitizeText(updates.avatar) ?? profile.avatar
  const nextGoals = Array.isArray(updates.fitnessGoals)
    ? updates.fitnessGoals.map((goal) => goal.trim()).filter(Boolean)
    : profile.fitnessGoals

  const updatedProfile = await prisma.user.update({
    data: {
      avatar: nextAvatar,
      fitnessGoals: nextGoals,
      name: nextName,
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
        fitnessGoals: nextGoals,
        full_name: nextName,
        name: nextName,
      },
    })

    if (error) {
      throw new AuthServiceError(error.message, 400)
    }
  }

  return {
    message: "Hồ sơ đã được cập nhật.",
    profile: serializeProfile(updatedProfile),
    session: null,
    user: serializeAuthUser(authUser),
  } satisfies AuthResult
}

async function requestPasswordReset(input: { email: string; redirectTo?: string }) {
  const client = ensureAuthClient()
  const email = await resolveLoginEmail(input.email)

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: input.redirectTo ?? `${env.frontendUrl}/auth/callback?next=/reset-password`,
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  return {
    message: "Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.",
    profile: null,
    session: null,
    user: null,
  } satisfies AuthResult
}

async function logoutCurrentSession(accessToken: string) {
  const client = ensureAdminClient()
  const { error } = await client.auth.admin.signOut(accessToken, "global")

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  return {
    message: "Đăng xuất thành công.",
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
  updateCurrentProfile,
}
