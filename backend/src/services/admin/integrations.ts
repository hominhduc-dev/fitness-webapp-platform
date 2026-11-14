import { UserRole, type Prisma } from "@prisma/client"
import { z } from "zod"

import { createAIProvider } from "../../lib/ai/ai-client"
import { envAIConfig, setAIOverride, currentAIConfig, type AIConfig } from "../../lib/ai/ai-config"
import { logger } from "../../lib/logger"
import { decryptToken, encryptToken, isTokenCryptoConfigured } from "../../lib/token-crypto"
import type { SerializedProfile } from "../auth.service"
import { AppError, ConflictError, ForbiddenError } from "../errors"
import { ensurePrisma } from "../fitness-data/shared/guards"

const AI_KEY = "ai"
const REFRESH_MS = 60_000

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) throw new ForbiddenError("Chỉ admin mới được quản lý API tích hợp.")
}

/**
 * `apiKey` omitted keeps the stored key; a new value replaces it. Base URLs must be https so a key
 * is never sent in clear text (localhost is allowed for self-hosted gateways during development).
 */
export const aiIntegrationSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z.string().trim().min(1).max(120),
  baseUrl: z.url().max(300).refine(value => /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value + "/"), "Base URL phải dùng https.").optional().or(z.literal("").transform(() => undefined)),
  jsonMode: z.boolean().default(true),
  apiKey: z.string().trim().min(8).max(500).optional(),
}).strict()
export type AIIntegrationInput = z.infer<typeof aiIntegrationSchema>

type StoredAIConfig = { provider: AIConfig["provider"]; model: string; baseUrl?: string; jsonMode: boolean }

function hint(secret: string | undefined) {
  return secret ? `…${secret.slice(-4)}` : null
}

/** What the admin page shows: never the key itself, only whether one exists and its last 4 characters. */
export async function getAdminIntegrations(profile: SerializedProfile) {
  assertAdmin(profile)
  const row = await ensurePrisma().integrationSetting.findUnique({ where: { key: AI_KEY } })
  const env = envAIConfig()
  const active = currentAIConfig()
  return {
    encryptionReady: isTokenCryptoConfigured(),
    ai: {
      source: row ? "database" as const : "env" as const,
      provider: active.provider, model: active.model, baseUrl: active.baseUrl ?? null, jsonMode: active.jsonMode,
      hasApiKey: !!active.apiKey, apiKeyHint: row ? row.secretHint : hint(env.apiKey),
      updatedAt: row?.updatedAt ?? null,
      env: { provider: env.provider, model: env.model, baseUrl: env.baseUrl ?? null, hasApiKey: !!env.apiKey },
    },
  }
}

async function readStoredAI(): Promise<AIConfig | null> {
  const row = await ensurePrisma().integrationSetting.findUnique({ where: { key: AI_KEY } })
  if (!row) return null
  const config = row.config as unknown as StoredAIConfig
  return { ...config, apiKey: row.secretCiphertext ? decryptToken(row.secretCiphertext) : undefined, source: "database" }
}

/** Merges the form with what is stored so "leave the key blank" keeps the current one. */
async function resolveDraft(input: AIIntegrationInput): Promise<AIConfig> {
  const stored = await readStoredAI()
  const fallbackKey = stored?.provider === input.provider ? stored.apiKey : envAIConfig().provider === input.provider ? envAIConfig().apiKey : undefined
  return { provider: input.provider, model: input.model, baseUrl: input.baseUrl, jsonMode: input.jsonMode, apiKey: input.apiKey ?? fallbackKey, source: "database" }
}

export async function saveAdminAIIntegration(profile: SerializedProfile, input: AIIntegrationInput) {
  assertAdmin(profile)
  if (!isTokenCryptoConfigured()) throw new ConflictError("Máy chủ chưa có GOOGLE_TOKEN_ENCRYPTION_KEY nên không thể lưu API key an toàn.")
  const draft = await resolveDraft(input)
  if (!draft.apiKey) throw new ConflictError("Cần nhập API key cho nhà cung cấp này.")
  const db = ensurePrisma()
  const config: StoredAIConfig = { provider: draft.provider, model: draft.model, jsonMode: draft.jsonMode, ...(draft.baseUrl ? { baseUrl: draft.baseUrl } : {}) }
  const secret = { secretCiphertext: encryptToken(draft.apiKey), secretHint: hint(draft.apiKey) }
  await db.$transaction(async tx => {
    await tx.integrationSetting.upsert({ where: { key: AI_KEY },
      create: { key: AI_KEY, config: config as unknown as Prisma.InputJsonValue, ...secret, updatedById: profile.id },
      update: { config: config as unknown as Prisma.InputJsonValue, ...secret, updatedById: profile.id } })
    // The key itself never goes into the audit trail — only whether it changed.
    await tx.adminAuditLog.create({ data: { adminId: profile.id, action: "integration.ai.update", entityType: "integration", entityLabel: "AI",
      metadata: { provider: config.provider, model: config.model, baseUrl: config.baseUrl ?? null, apiKeyChanged: !!input.apiKey } } })
  })
  setAIOverride(draft)
  return getAdminIntegrations(profile)
}

export async function resetAdminAIIntegration(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()
  await db.$transaction(async tx => {
    await tx.integrationSetting.deleteMany({ where: { key: AI_KEY } })
    await tx.adminAuditLog.create({ data: { adminId: profile.id, action: "integration.ai.reset", entityType: "integration", entityLabel: "AI", metadata: {} } })
  })
  setAIOverride(null)
  return getAdminIntegrations(profile)
}

/** Maps provider failures to messages an admin can act on, without echoing provider text that may quote the key. */
function describeFailure(error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined
  if (error instanceof AppError && error.code === "AI_NOT_CONFIGURED") return { code: "MISSING_KEY", message: "Chưa có API key cho nhà cung cấp này." }
  if (status === 401 || status === 403) return { code: "INVALID_KEY", status, message: "API key không hợp lệ hoặc không có quyền." }
  if (status === 404) return { code: "NOT_FOUND", status, message: "Không tìm thấy model hoặc Base URL sai." }
  if (status === 429) return { code: "RATE_LIMITED", status, message: "Nhà cung cấp đang giới hạn lượt gọi hoặc đã hết quota." }
  if (status && status >= 500) return { code: "PROVIDER_DOWN", status, message: "Nhà cung cấp đang lỗi, thử lại sau." }
  if ((error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError") return { code: "TIMEOUT", message: "Quá 15 giây không có phản hồi." }
  return { code: "UNKNOWN", status, message: "Không kết nối được. Kiểm tra Base URL và model." }
}

/** Sends one tiny request with the unsaved form values so an admin can verify before switching production traffic. */
export async function testAdminAIIntegration(profile: SerializedProfile, input: AIIntegrationInput) {
  assertAdmin(profile)
  const draft = await resolveDraft(input)
  const started = Date.now()
  try {
    const provider = createAIProvider(draft)
    await provider.generateWithTools({ systemPrompt: "Reply with the single word OK.", messages: [{ role: "user", content: "ping" }], tools: [], maxTokens: 16, signal: AbortSignal.timeout(15_000) })
    return { ok: true as const, latencyMs: Date.now() - started }
  } catch (error) {
    return { ok: false as const, latencyMs: Date.now() - started, ...describeFailure(error) }
  }
}

/** Loads the saved override into memory; keeps .env values when the table is empty or unreadable. */
export async function refreshAIIntegration() {
  try {
    setAIOverride(await readStoredAI())
  } catch (error) {
    logger.warn("integration settings refresh failed; keeping current AI config", { error })
  }
}

let timer: ReturnType<typeof setInterval> | undefined
export function startIntegrationSettingsRefresh() {
  if (timer) return
  void refreshAIIntegration()
  timer = setInterval(() => void refreshAIIntegration(), REFRESH_MS)
  timer.unref()
}
export function stopIntegrationSettingsRefresh() {
  if (timer) clearInterval(timer)
  timer = undefined
}
