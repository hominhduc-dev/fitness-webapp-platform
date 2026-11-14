import { AppError } from "../../services/errors"
import { aiConfigVersion, currentAIConfig, type AIConfig } from "./ai-config"
import { createAnthropicProvider } from "./anthropic-provider"
import { createOpenAIProvider } from "./openai-provider"
import type { AIProvider } from "./types"

let cachedProvider: AIProvider | null = null
let cachedVersion = -1

function missingKeyError(config: AIConfig) {
  return new AppError(`Tính năng AI chưa được cấu hình trên máy chủ.`, {
    code: "AI_NOT_CONFIGURED",
    details: { missing: config.provider === "openai" ? "OPENAI_API_KEY or AI_API_KEY" : "ANTHROPIC_API_KEY", provider: config.provider, source: config.source },
    status: 503,
  })
}

/** Builds a provider for an explicit config — used by the admin "test connection" action before saving. */
function createAIProvider(config: AIConfig): AIProvider {
  if (!config.apiKey) throw missingKeyError(config)
  return config.provider === "openai"
    ? createOpenAIProvider(config.apiKey, config.model, config.baseUrl, config.jsonMode)
    : createAnthropicProvider(config.apiKey, config.model)
}

function getAIProvider(): AIProvider {
  // Rebuild when an admin changed the integration settings since the last build.
  if (cachedProvider && cachedVersion === aiConfigVersion()) {
    return cachedProvider
  }

  const version = aiConfigVersion()
  cachedProvider = createAIProvider(currentAIConfig())
  cachedVersion = version

  return cachedProvider
}

export { createAIProvider, getAIProvider, type AIProvider }
