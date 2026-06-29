import { createAnthropicProvider } from "./anthropic-provider"
import { createOpenAIProvider } from "./openai-provider"
import type { AIProvider } from "./types"

let cachedProvider: AIProvider | null = null

function getAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider
  }

  const provider = process.env.AI_PROVIDER ?? "anthropic"
  const model = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001"

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY or AI_API_KEY is required when AI_PROVIDER=openai")
    }
    const baseURL = process.env.AI_BASE_URL || undefined
    const jsonMode = process.env.AI_JSON_MODE !== "false"
    cachedProvider = createOpenAIProvider(apiKey, model, baseURL, jsonMode)
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic")
    }
    cachedProvider = createAnthropicProvider(apiKey, model)
  }

  return cachedProvider
}

export { getAIProvider, type AIProvider }
