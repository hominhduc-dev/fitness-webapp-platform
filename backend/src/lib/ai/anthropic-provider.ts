import Anthropic from "@anthropic-ai/sdk"

import type { AIProvider, AIResponse } from "./types"

function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey })

  return {
    async generateStructuredJSON<T>({
      systemPrompt,
      userPrompt,
      maxTokens = 4096,
    }: {
      systemPrompt: string
      userPrompt: string
      maxTokens?: number
    }): Promise<AIResponse<T>> {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })

      const textBlock = response.content.find((b) => b.type === "text")

      if (!textBlock || textBlock.type !== "text") {
        throw new Error("AI response contained no text content")
      }

      const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/)
      const raw = jsonMatch ? jsonMatch[1].trim() : textBlock.text.trim()
      const data = JSON.parse(raw) as T

      const tokenUsage =
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

      return { data, tokenUsage }
    },

    async generateText({
      systemPrompt,
      userPrompt,
      maxTokens = 1024,
    }: {
      systemPrompt: string
      userPrompt: string
      maxTokens?: number
    }): Promise<AIResponse<string>> {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })

      const textBlock = response.content.find((b) => b.type === "text")

      if (!textBlock || textBlock.type !== "text") {
        throw new Error("AI response contained no text content")
      }

      const tokenUsage =
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

      return { data: textBlock.text.trim(), tokenUsage }
    },
  }
}

export { createAnthropicProvider }
