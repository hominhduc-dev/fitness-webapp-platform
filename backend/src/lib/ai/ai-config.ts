import { env } from "../../config/env"

export type AIProviderName = "anthropic" | "openai"
export type AIConfig = {
  provider: AIProviderName
  model: string
  baseUrl?: string
  jsonMode: boolean
  apiKey?: string
  /** Where the active values come from: an admin override saved in the database, or .env. */
  source: "database" | "env"
}

/**
 * Admin override held in memory so `getAIProvider()` stays synchronous.
 * The integrations service loads it at startup, after each admin change, and on a short interval
 * so every backend instance converges without a restart.
 */
let override: AIConfig | null = null
let version = 0

export function envAIConfig(): AIConfig {
  return {
    provider: env.aiProvider,
    model: env.aiModel,
    baseUrl: env.aiBaseUrl,
    jsonMode: env.aiJsonMode,
    apiKey: env.aiProvider === "openai" ? env.openaiApiKey ?? env.aiApiKey : env.anthropicApiKey,
    source: "env",
  }
}

export function currentAIConfig(): AIConfig {
  return override ?? envAIConfig()
}

/** Bumps the version so the cached provider is rebuilt on its next use. */
export function setAIOverride(next: AIConfig | null) {
  const same = JSON.stringify(next) === JSON.stringify(override)
  override = next
  if (!same) version++
}

export function aiConfigVersion() {
  return version
}
