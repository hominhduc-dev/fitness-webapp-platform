import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { env } from "../config/env"
import * as huawei from "../lib/huawei-health"
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "../lib/time-zone"
import { decryptToken, encryptToken, isTokenCryptoConfigured } from "../lib/token-crypto"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { ensurePrisma } from "./fitness-data/shared/guards"

/**
 * One Huawei Health grant per user, for the data their own watch or band records.
 * Coaches train too, so both roles can connect; admins cannot.
 */
const CONNECTABLE_ROLES = ["coach", "trainee"] as const

export const HUAWEI_STATE_MAX_AGE = 10 * 60 * 1000
export function isHuaweiConfigured() {
  return huawei.isHuaweiOAuthConfigured() && isTokenCryptoConfigured()
}
function requireConfigured() {
  if (!isHuaweiConfigured()) throw new BadRequestError("Huawei Health chưa được cấu hình.", { code: "HUAWEI_NOT_CONFIGURED" })
}
function assertConnectableRole(profile: Pick<SerializedProfile, "role">) {
  if (!(CONNECTABLE_ROLES as readonly string[]).includes(profile.role)) {
    throw new BadRequestError("Tài khoản này không kết nối được Huawei Health.", { code: "HUAWEI_ROLE_UNSUPPORTED" })
  }
}
function sign(value: string) {
  requireConfigured()
  return createHmac("sha256", env.huaweiHealthClientSecret!).update(value).digest("base64url")
}
/**
 * The zone rides in the signed state because the callback is a redirect from
 * Huawei, which carries none of the client's headers.
 */
export function createHuaweiState(userId: string, timeZone: string) {
  const nonce = randomBytes(32).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ userId, timeZone, nonce, expires: Date.now() + HUAWEI_STATE_MAX_AGE })).toString("base64url")
  return { nonce, state: `${payload}.${sign(payload)}` }
}
export function verifyHuaweiState(state: string, nonce: string) {
  const invalid = () => new BadRequestError("Phiên kết nối Huawei không hợp lệ hoặc đã hết hạn. Hãy kết nối lại.", { code: "HUAWEI_STATE_INVALID" })
  const [payload, signature, extra] = state.split(".")
  if (!payload || !signature || extra || !nonce) throw invalid()
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid()
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (typeof value.userId !== "string" || value.nonce !== nonce || !Number.isFinite(value.expires) || value.expires <= Date.now()) throw invalid()
    return { userId: value.userId as string, timeZone: isValidTimeZone(value.timeZone) ? value.timeZone : DEFAULT_TIME_ZONE }
  } catch { throw invalid() }
}
export async function getHuaweiConnection(profile: SerializedProfile) {
  assertConnectableRole(profile)
  if (!isHuaweiConfigured()) return { configured: false, connected: false, lastSyncedAt: null, lastSyncError: null }
  const connection = await ensurePrisma().huaweiConnection.findUnique({ where: { userId: profile.id }, select: { lastSyncedAt: true, lastSyncError: true } })
  return { configured: true, connected: Boolean(connection), lastSyncedAt: connection?.lastSyncedAt ?? null, lastSyncError: connection?.lastSyncError ?? null }
}
export async function connectHuawei(userId: string, timeZone: string, code: string) {
  requireConfigured()
  const db = ensurePrisma()
  const user = await db.user.findFirst({ where: { id: userId, role: { in: [...CONNECTABLE_ROLES] } }, select: { id: true, role: true } })
  if (!user) throw new BadRequestError("Tài khoản không còn hợp lệ để kết nối Huawei Health.")
  const tokens = await huawei.exchangeCodeForTokens(code)
  if (!tokens.refreshToken) throw new BadRequestError("Huawei không cấp refresh token. Hãy kết nối lại.", { code: "HUAWEI_REFRESH_TOKEN_MISSING" })
  const granted = tokens.scope.split(" ")
  if (!huawei.SCOPES.some((scope) => scope !== "openid" && granted.includes(scope))) {
    throw new BadRequestError("Cần cấp ít nhất một quyền đọc dữ liệu sức khoẻ.", { code: "HUAWEI_SCOPE_MISSING" })
  }
  const data = {
    accessTokenEncrypted: encryptToken(tokens.accessToken),
    refreshTokenEncrypted: encryptToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt, scope: tokens.scope, timeZone,
    lastSyncedAt: null, lastSyncError: null,
  }
  await db.huaweiConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  return { role: user.role }
}
export async function disconnectHuawei(profile: SerializedProfile) {
  assertConnectableRole(profile)
  const db = ensurePrisma()
  const connection = await db.huaweiConnection.findUnique({ where: { userId: profile.id } })
  await db.huaweiConnection.deleteMany({ where: { userId: profile.id } })
  if (connection) {
    try { await huawei.revokeToken(decryptToken(connection.refreshTokenEncrypted)) } catch { /* Local disconnect must succeed even after key rotation. */ }
  }
  return { connected: false }
}
/** Takes a user id rather than a profile: the background sync acts without a request. */
export async function getHuaweiAccessToken(userId: string) {
  requireConfigured()
  const db = ensurePrisma()
  const connection = await db.huaweiConnection.findUnique({ where: { userId } })
  if (!connection) throw new BadRequestError("Hãy kết nối lại Huawei Health.", { code: "HUAWEI_RECONNECT_REQUIRED" })
  if (connection.expiresAt.getTime() > Date.now() + huawei.EXPIRY_SKEW_MS) return decryptToken(connection.accessTokenEncrypted)
  const tokens = await huawei.refreshAccessToken(decryptToken(connection.refreshTokenEncrypted))
  // Keyed on the refresh token, not updatedAt: sync bookkeeping bumps updatedAt,
  // but only a reconnect, rotation or disconnect replaces the grant itself.
  const updated = await db.huaweiConnection.updateMany({ where: { id: connection.id, refreshTokenEncrypted: connection.refreshTokenEncrypted }, data: {
    accessTokenEncrypted: encryptToken(tokens.accessToken), expiresAt: tokens.expiresAt,
    ...(tokens.refreshToken ? { refreshTokenEncrypted: encryptToken(tokens.refreshToken) } : {}),
  } })
  if (!updated.count) throw new BadRequestError("Kết nối Huawei Health đã thay đổi. Vui lòng thử lại.")
  return tokens.accessToken
}
