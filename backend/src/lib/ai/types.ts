interface AIResponse<T> {
  data: T
  tokenUsage: number
}

interface AIProvider {
  generateStructuredJSON<T>(options: {
    systemPrompt: string
    userPrompt: string
    maxTokens?: number
  }): Promise<AIResponse<T>>

  generateText(options: {
    systemPrompt: string
    userPrompt: string
    maxTokens?: number
  }): Promise<AIResponse<string>>
}

export type { AIProvider, AIResponse }
