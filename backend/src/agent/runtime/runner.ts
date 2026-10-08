import type { AIConversationMessage, AIProvider, AIToolCall, AIToolDefinition } from "../../lib/ai/types"

export type AgentResult = {
  reply: string
  status: "completed" | "budget_exceeded"
  steps: number
  toolCalls: number
  tokenUsage: number
}

/** Foreground runtime. Budgets prevent NEW work; in-flight operations are not cancelled. */
export async function runAgent(options: {
  provider: AIProvider
  systemPrompt: string
  messages: AIConversationMessage[]
  tools: AIToolDefinition[]
  execute: (call: AIToolCall) => Promise<unknown>
  limits?: { steps?: number; toolCalls?: number; tokens?: number; durationMs?: number }
}): Promise<AgentResult> {
  const limits = { steps: 8, toolCalls: 20, tokens: 20_000, durationMs: 45_000, ...options.limits }
  const started = Date.now()
  const messages = [...options.messages]
  let steps = 0
  let calls = 0
  let tokens = 0
  const stopped = (): AgentResult => ({
    reply: "Mình đã chạm giới hạn xử lý của lượt này. Phân tích chưa hoàn tất; hãy thu hẹp yêu cầu hoặc thử lại.",
    status: "budget_exceeded", steps, toolCalls: calls, tokenUsage: tokens,
  })
  const expired = () => Date.now() - started >= limits.durationMs
  while (steps < limits.steps && calls < limits.toolCalls && tokens < limits.tokens && !expired()) {
    // Conservative estimate also bounds growing context when providers omit usage.
    const inputEstimate = Math.ceil((options.systemPrompt.length + JSON.stringify(messages).length + JSON.stringify(options.tools).length) / 3)
    const remaining = limits.tokens - tokens - inputEstimate
    if (remaining <= 0) return stopped()
    const turn = await options.provider.generateWithTools({
      systemPrompt: options.systemPrompt, messages, tools: options.tools,
      maxTokens: Math.min(1024, remaining),
    })
    steps++
    tokens += Math.max(turn.tokenUsage || 0, inputEstimate + Math.ceil((turn.text.length + JSON.stringify(turn.toolCalls).length) / 3))
    if (tokens > limits.tokens || expired()) return stopped()
    if (!turn.toolCalls.length) {
      return { reply: turn.text.trim(), status: "completed", steps, toolCalls: calls, tokenUsage: tokens }
    }
    // Reject the entire oversized batch: never execute a partial action set.
    if (calls + turn.toolCalls.length > limits.toolCalls) return stopped()
    messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls })
    for (const call of turn.toolCalls) {
      if (expired()) return stopped()
      calls++
      let result: unknown
      if (!options.tools.some(tool => tool.name === call.name)) {
        result = { ok: false, code: "UNKNOWN_TOOL" }
      } else {
        try { result = await options.execute(call) }
        catch { result = { ok: false, code: "TOOL_FAILED", error: "Không lấy được dữ liệu. Không suy đoán kết quả." } }
      }
      const content = JSON.stringify(result) ?? "null"
      messages.push({ role: "tool", toolCallId: call.id, name: call.name,
        content: content.length <= 16_000 ? content : JSON.stringify({ ok: false, code: "OUTPUT_TOO_LARGE", error: "Thu hẹp phạm vi truy vấn." }),
      })
    }
  }
  return stopped()
}
