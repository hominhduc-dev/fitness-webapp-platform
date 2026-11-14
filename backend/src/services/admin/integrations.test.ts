import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), generate: vi.fn() }))
vi.mock("../fitness-data/shared/guards", () => ({ ensurePrisma: () => ({ integrationSetting: { findUnique: mocks.findUnique } }) }))
vi.mock("../../lib/token-crypto", () => ({ isTokenCryptoConfigured: () => true, encryptToken: (value: string) => `enc:${value}`, decryptToken: (value: string) => value.replace(/^enc:/, "") }))
vi.mock("../../lib/ai/ai-client", () => ({ createAIProvider: () => ({ generateWithTools: mocks.generate }) }))

import { getAdminIntegrations, testAdminAIIntegration } from "./integrations"
import { setAIOverride } from "../../lib/ai/ai-config"

const admin = { id: "admin", role: "admin" } as never
const secret = "sk-live-secret-1234"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findUnique.mockResolvedValue({ key: "ai", config: { provider: "openai", model: "m", jsonMode: true }, secretCiphertext: `enc:${secret}`, secretHint: "…1234", updatedAt: new Date() })
  setAIOverride({ provider: "openai", model: "m", jsonMode: true, apiKey: secret, source: "database" })
})

describe("admin integrations", () => {
  it("never returns the stored API key, only a hint", async () => {
    const result = await getAdminIntegrations(admin)
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(result.ai).toMatchObject({ source: "database", hasApiKey: true, apiKeyHint: "…1234" })
  })

  it("rejects non-admins", async () => {
    await expect(getAdminIntegrations({ id: "c", role: "coach" } as never)).rejects.toThrow()
  })

  it("maps provider rate limits to an actionable message without echoing provider text", async () => {
    mocks.generate.mockRejectedValue(Object.assign(new Error(`429 key ${secret}`), { status: 429 }))
    const result = await testAdminAIIntegration(admin, { provider: "openai", model: "m", jsonMode: true })
    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED", status: 429 })
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
