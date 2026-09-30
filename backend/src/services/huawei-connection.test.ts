import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findUser: vi.fn(), refresh: vi.fn(), exchange: vi.fn(), revoke: vi.fn() }))
vi.mock("../config/env", () => ({ env: { huaweiHealthClientId: "test", huaweiHealthClientSecret: "test", huaweiHealthRedirectUri: "http://localhost/callback", googleTokenEncryptionKey: Buffer.alloc(32, 3).toString("base64") } }))
vi.mock("../lib/prisma", () => ({ prisma: { huaweiConnection: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, upsert: mocks.upsert, deleteMany: mocks.deleteMany }, user: { findFirst: mocks.findUser } } }))
vi.mock("../lib/huawei-health", async (original) => ({ ...await original<typeof import("../lib/huawei-health")>(), refreshAccessToken: mocks.refresh, exchangeCodeForTokens: mocks.exchange, revokeToken: mocks.revoke }))
import { connectHuawei, createHuaweiState, disconnectHuawei, getHuaweiAccessToken, getHuaweiConnection, verifyHuaweiState } from "./huawei-connection.service"
import { encryptToken, decryptToken } from "../lib/token-crypto"
import type { SerializedProfile } from "./auth.service"
const trainee = { id: "trainee", role: "trainee" } as SerializedProfile
const STEP_SCOPE = "openid https://www.huawei.com/healthkit/step.read"
describe("Huawei connection", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findUser.mockResolvedValue({ id: "trainee", role: "trainee" }); mocks.updateMany.mockResolvedValue({ count: 1 }) })
  it("round-trips the user and time zone through a signed state bound to the cookie nonce", () => {
    const { nonce, state } = createHuaweiState("trainee", "Asia/Bangkok")
    expect(verifyHuaweiState(state, nonce)).toEqual({ userId: "trainee", timeZone: "Asia/Bangkok" })
    expect(() => verifyHuaweiState(state, "other-nonce")).toThrow(/không hợp lệ/)
    const [payload] = state.split(".")
    expect(() => verifyHuaweiState(`${payload}.forged`, nonce)).toThrow(/không hợp lệ/)
  })
  it("stores encrypted tokens and the connecting zone, and resets sync status on reconnect", async () => {
    mocks.exchange.mockResolvedValue({ accessToken: "access", refreshToken: "refresh", scope: STEP_SCOPE, expiresAt: new Date() })
    await expect(connectHuawei("trainee", "Asia/Ho_Chi_Minh", "code")).resolves.toEqual({ role: "trainee" })
    const { create, update } = mocks.upsert.mock.calls[0][0]
    expect(decryptToken(create.refreshTokenEncrypted)).toBe("refresh")
    expect(create.accessTokenEncrypted).not.toContain("access")
    expect(update).toMatchObject({ timeZone: "Asia/Ho_Chi_Minh", lastSyncedAt: null, lastSyncError: null })
  })
  it("rejects a grant without a refresh token or without any health scope", async () => {
    mocks.exchange.mockResolvedValue({ accessToken: "access", scope: STEP_SCOPE })
    await expect(connectHuawei("trainee", "UTC", "code")).rejects.toThrow(/refresh token/)
    mocks.exchange.mockResolvedValue({ accessToken: "access", refreshToken: "refresh", scope: "openid" })
    await expect(connectHuawei("trainee", "UTC", "code")).rejects.toThrow(/quyền đọc/)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("refreshes an expiring token, keeping the stored refresh token when none is rotated in", async () => {
    const stored = encryptToken("refresh")
    mocks.findUnique.mockResolvedValue({ id: "c", expiresAt: new Date(Date.now() + 10_000), accessTokenEncrypted: encryptToken("old"), refreshTokenEncrypted: stored })
    mocks.refresh.mockResolvedValue({ accessToken: "new", expiresAt: new Date(Date.now() + 3_600_000) })
    expect(await getHuaweiAccessToken("trainee")).toBe("new")
    const { where, data } = mocks.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: "c", refreshTokenEncrypted: stored })
    expect(data).not.toHaveProperty("refreshTokenEncrypted")
  })
  it("does not overwrite a grant replaced during refresh", async () => {
    mocks.findUnique.mockResolvedValue({ id: "c", expiresAt: new Date(0), refreshTokenEncrypted: encryptToken("refresh") })
    mocks.refresh.mockResolvedValue({ accessToken: "new", expiresAt: new Date() }); mocks.updateMany.mockResolvedValue({ count: 0 })
    await expect(getHuaweiAccessToken("trainee")).rejects.toThrow(/thay đổi/)
  })
  it("disconnects locally even when revocation fails, and hides tokens from status", async () => {
    mocks.findUnique.mockResolvedValue({ refreshTokenEncrypted: encryptToken("refresh"), lastSyncedAt: null, lastSyncError: null })
    expect(await getHuaweiConnection(trainee)).toEqual({ configured: true, connected: true, lastSyncedAt: null, lastSyncError: null })
    mocks.revoke.mockRejectedValue(new Error("offline"))
    await expect(disconnectHuawei(trainee)).resolves.toEqual({ connected: false })
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "trainee" } })
    await expect(getHuaweiConnection({ ...trainee, role: "admin" })).rejects.toThrow()
  })
})
