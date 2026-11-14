import type { AIConversationMessage } from "../../lib/ai/types"
export type AgentRunContext = { subjectId: string; subjectName: string; programId?: string; programName?: string }
export type Checkpoint = { messages: AIConversationMessage[]; startedAt: number; timeZone?: string; context?: AgentRunContext }
/** Remove only completed old tool exchanges, keeping the current request and unresolved calls intact. */
export function compactContext(messages: AIConversationMessage[], maxChars = 24_000): AIConversationMessage[] {
  const result = [...messages]
  if (JSON.stringify(result).length <= maxChars) return result
  const lastUser = result.map(message => message.role).lastIndexOf("user")
  for (let i = 0; i < result.length; i++) {
    const message = result[i]
    if (message.role === "tool" && message.content.length > 600) {
      // Preserve IDs, failures and proposals. Other results are replaceable by re-reading services.
      if (!/approval|payloadHash|"ok":false|"code"/.test(message.content)) result[i] = { ...message, content: JSON.stringify({ compacted: true, instruction: "Result evicted. Re-read this tool if evidence is needed; never infer discarded values." }) }
    }
  }
  // Drop old plain conversation pairs; never orphan tool_use/tool_result messages.
  while (JSON.stringify(result).length > maxChars && result.length > 2 && lastUser > 0) {
    const currentUserIndex = result.map(message => message.role).lastIndexOf("user")
    const index = result.findIndex((message, i) => i < currentUserIndex &&
      (message.role === "user" || message.role === "assistant" && !message.toolCalls?.length))
    if (index < 0) break
    result.splice(index, 1)
  }
  // Model/tool protocol groups are never dropped or split.
  return result
}
