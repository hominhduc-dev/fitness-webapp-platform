import { randomBytes, createHmac, timingSafeEqual } from "node:crypto"
import { env } from "../config/env"
import * as google from "../lib/google"
import { decryptToken, encryptToken, isTokenCryptoConfigured } from "../lib/token-crypto"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { assertCoach, ensurePrisma } from "./fitness-data/shared/guards"

export const GOOGLE_STATE_MAX_AGE = 10 * 60 * 1000
export function isGoogleConfigured() {
  return google.isGoogleOAuthConfigured() && isTokenCryptoConfigured()
}
function requireConfigured() {
  if (!isGoogleConfigured()) throw new BadRequestError("Google chưa được cấu hình.", { code: "GOOGLE_NOT_CONFIGURED" })
}
function sign(value: string) {
  requireConfigured()
  return createHmac("sha256", env.googleOauthClientSecret!).update(value).digest("base64url")
}
export function createGoogleState(userId: string) {
  const nonce = randomBytes(32).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ userId, nonce, expires: Date.now() + GOOGLE_STATE_MAX_AGE })).toString("base64url")
  return { nonce, state: `${payload}.${sign(payload)}` }
}
export function verifyGoogleState(state: string, nonce: string) {
  const invalid = () => new BadRequestError("Phiên kết nối Google không hợp lệ hoặc đã hết hạn. Hãy kết nối lại.", { code: "GOOGLE_STATE_INVALID" })
  const [payload, signature, extra] = state.split(".")
  if (!payload || !signature || extra || !nonce) throw invalid()
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid()
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (typeof value.userId !== "string" || value.nonce !== nonce || !Number.isFinite(value.expires) || value.expires <= Date.now()) throw invalid()
    return value.userId as string
  } catch { throw invalid() }
}
export async function getGoogleConnection(profile: SerializedProfile) {
  assertCoach(profile)
  if (!isGoogleConfigured()) return { configured: false, connected: false, email: null }
  const connection = await ensurePrisma().googleConnection.findUnique({ where: { userId: profile.id } })
  return { configured: true, connected: Boolean(connection?.refreshTokenEncrypted), email: connection?.googleEmail ?? null }
}
export async function connectGoogle(userId: string, code: string) {
  requireConfigured()
  const db = ensurePrisma()
  const user = await db.user.findFirst({ where: { id: userId, role: "coach" } })
  if (!user) throw new BadRequestError("Tài khoản coach không còn hợp lệ.")
  const tokens = await google.exchangeCodeForTokens(code)
  if (!tokens.refreshToken) throw new BadRequestError("Google không cấp refresh token. Hãy kết nối lại và cấp quyền truy cập ngoại tuyến.", { code: "GOOGLE_REFRESH_TOKEN_MISSING" })
  if (!tokens.scope.split(" ").includes(google.SCOPES[0])) throw new BadRequestError("Cần cấp quyền đọc và ghi Google Sheets.", { code: "GOOGLE_SCOPE_MISSING" })
  const data = {
    accessTokenEncrypted: encryptToken(tokens.accessToken),
    refreshTokenEncrypted: encryptToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt, scope: tokens.scope,
    googleEmail: (await google.fetchGoogleEmail(tokens.accessToken)) ?? null,
  }
  await db.googleConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data })
}
export async function disconnectGoogle(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const connection = await db.googleConnection.findUnique({ where: { userId: profile.id } })
  await db.googleConnection.deleteMany({ where: { userId: profile.id } })
  if (connection) {
    try { await google.revokeToken(decryptToken(connection.refreshTokenEncrypted ?? connection.accessTokenEncrypted)) } catch { /* Local disconnect must succeed even after key rotation. */ }
  }
  return { connected: false }
}
export async function getGoogleAccessToken(profile: SerializedProfile) {
  assertCoach(profile)
  requireConfigured()
  const db = ensurePrisma()
  const connection = await db.googleConnection.findUnique({ where: { userId: profile.id } })
  if (!connection?.refreshTokenEncrypted) throw new BadRequestError("Hãy kết nối lại tài khoản Google.", { code: "GOOGLE_RECONNECT_REQUIRED" })
  if (connection.expiresAt.getTime() > Date.now() + google.EXPIRY_SKEW_MS) return decryptToken(connection.accessTokenEncrypted)
  const tokens = await google.refreshAccessToken(decryptToken(connection.refreshTokenEncrypted))
  // Conditional update cannot resurrect a disconnected grant or overwrite a newer connection.
  const updated = await db.googleConnection.updateMany({ where: { id: connection.id, updatedAt: connection.updatedAt }, data: {
    accessTokenEncrypted: encryptToken(tokens.accessToken), expiresAt: tokens.expiresAt,
    ...(tokens.refreshToken ? { refreshTokenEncrypted: encryptToken(tokens.refreshToken) } : {}),
  } })
  if (!updated.count) throw new BadRequestError("Kết nối Google đã thay đổi. Vui lòng thử lại.")
  return tokens.accessToken
}
