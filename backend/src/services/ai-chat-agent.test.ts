import { describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"
const mocks = vi.hoisted(() => ({ generate: vi.fn(), read: vi.fn() }))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => ({ supportsTools: true, generateWithTools: mocks.generate }) }))
vi.mock("./ai/context/builder", () => ({ buildTraineeChatContext: vi.fn().mockResolvedValue(null) }))
vi.mock("../agent/tools/training.tools", () => ({
  trainingReadTools: [{ name: "get_readiness", description: "read", parameters: {} }],
  executeTrainingReadTool: mocks.read,
}))
import { chatWithAI } from "./ai.service"
describe("existing chat endpoint agent integration", () => {
  it("dispatches repeated read turns with the authenticated profile and preserves response shape", async () => {
    const profile = { id: "chat-self", role: "trainee", name: "Test" } as SerializedProfile
    const call = { id: "r1", name: "get_readiness", arguments: {} }
    mocks.read.mockResolvedValue({ ok: true, data: { score: 70 } })
    mocks.generate.mockResolvedValueOnce({ text: "", toolCalls: [call], tokenUsage: 100 })
      .mockResolvedValueOnce({ text: "", toolCalls: [{ ...call, id: "r2" }], tokenUsage: 100 })
      .mockResolvedValueOnce({ text: "Readiness: 70", toolCalls: [], tokenUsage: 100 })
    expect(await chatWithAI(profile, "Phân tích phục hồi", [])).toEqual({ reply: "Readiness: 70" })
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.read).toHaveBeenCalledWith(profile, call)
  })
})
