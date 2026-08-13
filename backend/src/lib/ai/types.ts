interface AIResponse<T> {
  data: T
  tokenUsage: number
}

/** A tool the model may call, described with JSON Schema parameters. */
interface AIToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Provider-neutral conversation turn. Providers translate these into their own
 * wire format, so the chat loop never has to care whether it is talking to
 * Anthropic (tool_use / tool_result content blocks) or an OpenAI-compatible
 * endpoint (tool_calls / role:"tool" messages).
 */
type AIConversationMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AIToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string }

interface AIToolTurn {
  text: string
  toolCalls: AIToolCall[]
  tokenUsage: number
}

interface AIProvider {
  /** False for providers/models that cannot do function calling. */
  readonly supportsTools: boolean

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

  generateWithTools(options: {
    systemPrompt: string
    messages: AIConversationMessage[]
    tools: AIToolDefinition[]
    maxTokens?: number
  }): Promise<AIToolTurn>
}

export type {
  AIConversationMessage,
  AIProvider,
  AIResponse,
  AIToolCall,
  AIToolDefinition,
  AIToolTurn,
}
