import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

import { getAIRequestTimeoutMs, withAIRequestTimeout } from "./request-timeout"
import type {
  AIConversationMessage,
  AIProvider,
  AIResponse,
  AIToolCall,
  AIToolDefinition,
  AIToolTurn,
} from "./types"

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"

const REASONING_EFFORT_VALUES: ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh"]

function getReasoningEffort(): ReasoningEffort | undefined {
  const effort = process.env.AI_REASONING_EFFORT?.trim()
  return REASONING_EFFORT_VALUES.includes(effort as ReasoningEffort) ? (effort as ReasoningEffort) : undefined
}

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

function toWireMessages(messages: AIConversationMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      }
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content || null,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            }
          : {}),
      } as ChatCompletionMessageParam
    }

    return { role: "user", content: message.content }
  })
}

function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function createOpenAIProvider(
  apiKey: string,
  model: string,
  baseURL?: string,
  jsonMode = true,
): AIProvider {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  const reasoningEffort = getReasoningEffort()

  return {
    supportsTools: true,

    async generateWithTools({
      systemPrompt,
      messages,
      tools,
      maxTokens = 1024,
    }: {
      systemPrompt: string
      messages: AIConversationMessage[]
      tools: AIToolDefinition[]
      maxTokens?: number
    }): Promise<AIToolTurn> {
      const response = await withAIRequestTimeout(
        client.chat.completions.create(
          {
            model,
            max_tokens: maxTokens,
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            tools: tools.map((tool) => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            messages: [
              { role: "system", content: systemPrompt },
              ...toWireMessages(messages),
            ],
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

      const choice = response.choices[0]?.message
      const toolCalls: AIToolCall[] = (choice?.tool_calls ?? []).flatMap((call) =>
        "function" in call
          ? [{ id: call.id, name: call.function.name, arguments: parseToolArguments(call.function.arguments) }]
          : [],
      )

      return {
        text: stripThoughts(choice?.content ?? ""),
        toolCalls,
        tokenUsage:
          (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
      }
    },

    async generateStructuredJSON<T>({
      systemPrompt,
      userPrompt,
      maxTokens = 4096,
    }: {
      systemPrompt: string
      userPrompt: string
      maxTokens?: number
    }): Promise<AIResponse<T>> {
      const response = await withAIRequestTimeout(
        client.chat.completions.create(
          {
            model,
            max_tokens: maxTokens,
            // Some OpenAI-compatible models (e.g. Gemma via Google AI Studio) reject
            // response_format. Disable json mode via AI_JSON_MODE=false for those.
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

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
      const response = await withAIRequestTimeout(
        client.chat.completions.create(
          {
            model,
            max_tokens: maxTokens,
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

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
