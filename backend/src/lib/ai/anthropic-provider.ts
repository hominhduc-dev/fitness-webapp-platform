import Anthropic from "@anthropic-ai/sdk"

import { ExternalServiceError } from "../../services/errors"

import { getAIRequestTimeoutMs, withAIRequestTimeout } from "./request-timeout"
import { extractJSON, stripThoughts } from "./response-parsing"
import type {
  AIConversationMessage,
  AIProvider,
  AIResponse,
  AIToolCall,
  AIToolDefinition,
  AIToolTurn,
} from "./types"

/**
 * Anthropic carries tool results as content blocks rather than a dedicated
 * message role: an assistant turn holds `tool_use` blocks, and the result comes
 * back on the *user* turn as `tool_result`.
 */
function toWireMessages(messages: AIConversationMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: message.toolCallId,
            content: message.content,
          },
        ],
      }
    }

    if (message.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (message.content.trim()) {
        blocks.push({ type: "text", text: message.content })
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments })
      }
      return { role: "assistant" as const, content: blocks.length > 0 ? blocks : message.content }
    }

    return { role: "user" as const, content: message.content }
  })
}

function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey })

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
        client.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters as Anthropic.Tool["input_schema"],
            })),
            messages: toWireMessages(messages),
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim()

      const toolCalls: AIToolCall[] = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        }))

      return {
        text,
        toolCalls,
        tokenUsage:
          (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
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
        client.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

      const textBlock = response.content.find((b) => b.type === "text")

      if (!textBlock || textBlock.type !== "text") {
        throw new ExternalServiceError("Nhà cung cấp AI trả về nội dung rỗng.", { code: "AI_EMPTY_RESPONSE" })
      }

      const data = extractJSON<T>(textBlock.text)

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
      const response = await withAIRequestTimeout(
        client.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          },
          { timeout: getAIRequestTimeoutMs() },
        ),
      )

      const textBlock = response.content.find((b) => b.type === "text")

      if (!textBlock || textBlock.type !== "text") {
        throw new ExternalServiceError("Nhà cung cấp AI trả về nội dung rỗng.", { code: "AI_EMPTY_RESPONSE" })
      }

      const tokenUsage =
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

      return { data: stripThoughts(textBlock.text), tokenUsage }
    },
  }
}

export { createAnthropicProvider }
