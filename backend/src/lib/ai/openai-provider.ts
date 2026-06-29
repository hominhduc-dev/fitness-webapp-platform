import OpenAI from "openai"

import type { AIProvider, AIResponse } from "./types"

/**
 * Removes reasoning blocks that thinking models (e.g. Gemma via Google AI Studio)
 * emit before the real answer: <thought>...</thought> / <thinking>...</thinking>.
 * If the model ran out of tokens mid-thought (no closing tag), drop the dangling
 * open block too so we don't return raw reasoning to the user.
 */
function stripThoughts(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<think(?:ing)?>[\s\S]*$/gi, "")
    .replace(/<thought>[\s\S]*$/gi, "")
    .trim()
}

/**
 * Extracts a JSON object from a raw model response. Handles:
 * 1. Reasoning blocks — stripped first so a draft JSON inside <thought> isn't
 *    mistaken for the answer.
 * 2. Plain JSON.
 * 3. JSON wrapped in a ```json ... ``` markdown fence.
 * 4. JSON embedded in surrounding prose (grabs the outermost {...} span).
 */
function extractJSON<T>(text: string): T {
  const trimmed = stripThoughts(text)

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T
  }

  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Fall back to grabbing the outermost { ... } span.
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    }
    throw new Error("AI response did not contain valid JSON")
  }
}

function createOpenAIProvider(
  apiKey: string,
  model: string,
  baseURL?: string,
  jsonMode = true,
): AIProvider {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })

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
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        // Some OpenAI-compatible models (e.g. Gemma via Google AI Studio) reject
        // response_format. Disable json mode via AI_JSON_MODE=false for those.
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      })

      const text = response.choices[0]?.message?.content

      if (!text) {
        throw new Error("AI response contained no text content")
      }

      const data = extractJSON<T>(text)

      const tokenUsage =
        (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)

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
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      })

      const text = response.choices[0]?.message?.content

      if (!text) {
        throw new Error("AI response contained no text content")
      }

      const tokenUsage =
        (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)

      return { data: stripThoughts(text), tokenUsage }
    },
  }
}

export { createOpenAIProvider }
