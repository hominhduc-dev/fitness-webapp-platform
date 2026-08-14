import { env } from "../../config/env"
import { AppError } from "../../services/errors"
import { createAnthropicProvider } from "./anthropic-provider"
import { createOpenAIProvider } from "./openai-provider"
import type { AIProvider } from "./types"

let cachedProvider: AIProvider | null = null

function missingKeyError(variable: string) {
  return new AppError(`Tính năng AI chưa được cấu hình trên máy chủ.`, {
    code: "AI_NOT_CONFIGURED",
    details: { missing: variable, provider: env.aiProvider },
    status: 503,
  })
}

function getAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider
  }

  if (env.aiProvider === "openai") {
    const apiKey = env.openaiApiKey ?? env.aiApiKey

    if (!apiKey) {
      throw missingKeyError("OPENAI_API_KEY or AI_API_KEY")
    }

    cachedProvider = createOpenAIProvider(apiKey, env.aiModel, env.aiBaseUrl, env.aiJsonMode)
  } else {
    if (!env.anthropicApiKey) {
      throw missingKeyError("ANTHROPIC_API_KEY")
    }

    cachedProvider = createAnthropicProvider(env.anthropicApiKey, env.aiModel)
  }

  return cachedProvider
}

export { getAIProvider, type AIProvider }
