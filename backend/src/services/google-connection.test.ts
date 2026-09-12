import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findUser: vi.fn(), refresh: vi.fn(), exchange: vi.fn(), revoke: vi.fn() }))
vi.mock("../config/env", () => ({ env: { googleOauthClientId: "test", googleOauthClientSecret: "test", googleOauthRedirectUri: "http://localhost/callback", googleTokenEncryptionKey: Buffer.alloc(32, 2).toString("base64") } }))
vi.mock("../lib/prisma", () => ({ prisma: { googleConnection: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, upsert: mocks.upsert, deleteMany: mocks.deleteMany }, user: { findFirst: mocks.findUser } } }))
vi.mock("../lib/google", async (original) => ({ ...await original<typeof import("../lib/google")>(), refreshAccessToken: mocks.refresh, exchangeCodeForTokens: mocks.exchange, revokeToken: mocks.revoke, fetchGoogleEmail: vi.fn().mockResolvedValue("coach@example.invalid") }))
import { connectGoogle, disconnectGoogle, getGoogleAccessToken, getGoogleConnection } from "./google-connection.service"
import { encryptToken, decryptToken } from "../lib/token-crypto"
import type { SerializedProfile } from "./auth.service"
const coach = { id: "coach", role: "coach" } as SerializedProfile
describe("Google connection persistence", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findUser.mockResolvedValue({ id: "coach" }); mocks.updateMany.mockResolvedValue({ count: 1 }) })
  it("refreshes early without replacing the stored refresh token with undefined", async () => {
    mocks.findUnique.mockResolvedValue({ id: "connection", updatedAt: new Date(1), expiresAt: new Date(Date.now() + 10_000), accessTokenEncrypted: encryptToken("old"), refreshTokenEncrypted: encryptToken("refresh") })
    mocks.refresh.mockResolvedValue({ accessToken: "new", expiresAt: new Date(Date.now() + 3_600_000) })
    expect(await getGoogleAccessToken(coach)).toBe("new")
    expect(mocks.refresh).toHaveBeenCalledWith("refresh")
    const data = mocks.updateMany.mock.calls[0][0].data
    expect(data).not.toHaveProperty("refreshTokenEncrypted")
    expect(decryptToken(data.accessTokenEncrypted)).toBe("new")
  })
  it("does not revive a connection removed during refresh", async () => {
    mocks.findUnique.mockResolvedValue({ id: "connection", updatedAt: new Date(1), expiresAt: new Date(0), refreshTokenEncrypted: encryptToken("refresh") })
    mocks.refresh.mockResolvedValue({ accessToken: "new", expiresAt: new Date() }); mocks.updateMany.mockResolvedValue({ count: 0 })
    await expect(getGoogleAccessToken(coach)).rejects.toThrow(/thay đổi/)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("rejects missing refresh tokens and insufficient scopes before persistence", async () => {
    mocks.exchange.mockResolvedValue({ accessToken: "access", scope: "https://www.googleapis.com/auth/spreadsheets" })
    await expect(connectGoogle("coach", "code")).rejects.toThrow(/refresh token/)
    mocks.exchange.mockResolvedValue({ accessToken: "access", refreshToken: "refresh", scope: "https://www.googleapis.com/auth/spreadsheets.readonly" })
    await expect(connectGoogle("coach", "code")).rejects.toThrow(/đọc và ghi/)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("disconnects locally even when token revocation fails", async () => {
    mocks.findUnique.mockResolvedValue({ refreshTokenEncrypted: encryptToken("refresh") })
    mocks.revoke.mockRejectedValue(new Error("offline"))
    await expect(disconnectGoogle(coach)).resolves.toEqual({ connected: false })
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "coach" } })
  })
  it("does not reveal tokens in connection status and enforces coach role", async () => {
    mocks.findUnique.mockResolvedValue({ refreshTokenEncrypted: encryptToken("refresh"), googleEmail: "coach@example.invalid" })
    expect(await getGoogleConnection(coach)).toEqual({ configured: true, connected: true, email: "coach@example.invalid" })
    await expect(getGoogleConnection({ ...coach, role: "trainee" })).rejects.toThrow()
  })
})
