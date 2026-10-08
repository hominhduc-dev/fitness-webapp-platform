import { describe, expect, it } from "vitest"
import { compactContext } from "./checkpoint"
import type { AIConversationMessage } from "../../lib/ai/types"
describe("safe context compaction", () => {
  it("preserves pending approval payloads, failures and the current request", () => {
    const call = { id: "x", name: "read", arguments: {} }
    const messages: AIConversationMessage[] = [
      { role: "user", content: "Old request" }, { role: "assistant", content: "x".repeat(2000) },
      { role: "user", content: "Current request" }, { role: "assistant", content: "", toolCalls: [call] },
      { role: "tool", toolCallId: "x", name: "read", content: JSON.stringify({ approvalId: "pending", payloadHash: "hash", data: "x".repeat(2000) }) },
      { role: "tool", toolCallId: "y", name: "read", content: JSON.stringify({ ok: false, code: "FORBIDDEN", data: "x".repeat(2000) }) },
    ]
    const result = compactContext(messages, 1000)
    expect(result.some(item => item.content === "Current request")).toBe(true)
    expect(result.some(item => item.content.includes("payloadHash"))).toBe(true)
    expect(result.some(item => item.content.includes("FORBIDDEN"))).toBe(true)
    expect(result.some(item => item.role === "assistant" && item.toolCalls?.[0].id === "x")).toBe(true)
  })
  it("evicts replaceable large tool data using a valid JSON marker", () => {
    const result = compactContext([{ role: "user", content: "Current" }, { role: "tool", toolCallId: "x", name: "read", content: JSON.stringify({ data: "x".repeat(3000) }) }], 1000)
    expect(JSON.parse(result[1].content)).toMatchObject({ compacted: true })
  })
  it("does not mutate the saved checkpoint", () => {
    const messages: AIConversationMessage[] = [{ role: "tool", toolCallId: "x", name: "read", content: "x".repeat(5000) }]
    compactContext(messages, 10)
    expect(messages[0].content).toHaveLength(5000)
  })
})
