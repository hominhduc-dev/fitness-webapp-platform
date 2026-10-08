import { describe, expect, it, vi } from "vitest"
import type { AIProvider, AIToolTurn } from "../../lib/ai/types"
import { runAgent } from "./runner"

const call = { id: "call-1", name: "read", arguments: {} }
const tools = [{ name: "read", description: "read", parameters: {} }]
const turn = (toolCalls = [] as typeof call[], text = "done"): AIToolTurn => ({ text, toolCalls, tokenUsage: 50 })
function setup() {
  const generate = vi.fn<AIProvider["generateWithTools"]>()
  const provider = { supportsTools: true, generateWithTools: generate } as unknown as AIProvider
  const execute = vi.fn().mockResolvedValue({ ok: true, value: 1 })
  const options = { provider, execute, tools, messages: [{ role: "user" as const, content: "analyze" }], systemPrompt: "system" }
  return { generate, execute, options }
}

describe("agent runtime", () => {
  it("feeds results back and supports multiple dependent tool turns", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValueOnce(turn([call], "")).mockResolvedValueOnce(turn([{ ...call, id: "call-2" }], "")).mockResolvedValueOnce(turn())
    const result = await runAgent(options)
    expect(result).toMatchObject({ status: "completed", steps: 3, toolCalls: 2, reply: "done" })
    expect(execute).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[2][0].messages.filter(m => m.role === "tool")).toHaveLength(2)
  })
  it("never dispatches an unknown tool even if provider invents it", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValueOnce(turn([{ ...call, name: "execute_sql" }])).mockResolvedValueOnce(turn())
    await runAgent(options)
    expect(execute).not.toHaveBeenCalled()
    expect(JSON.stringify(generate.mock.calls[1][0].messages)).toContain("UNKNOWN_TOOL")
  })
  it("stops looping at the step limit", async () => {
    const { generate, options } = setup()
    generate.mockResolvedValue(turn([call]))
    expect(await runAgent({ ...options, limits: { steps: 2 } })).toMatchObject({ status: "budget_exceeded", steps: 2 })
    expect(generate).toHaveBeenCalledTimes(2)
  })
  it("does not partially execute a batch exceeding call budget", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValue(turn([call, { ...call, id: "call-2" }]))
    expect(await runAgent({ ...options, limits: { toolCalls: 1 } })).toMatchObject({ status: "budget_exceeded" })
    expect(execute).not.toHaveBeenCalled()
  })
  it("does not start model work when context exhausts budget", async () => {
    const { generate, options } = setup()
    expect(await runAgent({ ...options, limits: { tokens: 1 } })).toMatchObject({ status: "budget_exceeded" })
    expect(generate).not.toHaveBeenCalled()
  })
  it("rejects calls after the provider exhausts token budget", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValue({ ...turn([call]), tokenUsage: 50_000 })
    expect(await runAgent(options)).toMatchObject({ status: "budget_exceeded" })
    expect(execute).not.toHaveBeenCalled()
  })
  it("returns failures without exposing internal secrets", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValueOnce(turn([call])).mockResolvedValueOnce(turn())
    execute.mockRejectedValue(new Error("postgres://secret"))
    await runAgent(options)
    const messages = JSON.stringify(generate.mock.calls[1][0].messages)
    expect(messages).toContain("TOOL_FAILED")
    expect(messages).not.toContain("postgres://secret")
  })
  it("returns an explicit error for large data rather than broken JSON", async () => {
    const { generate, execute, options } = setup()
    generate.mockResolvedValueOnce(turn([call])).mockResolvedValueOnce(turn())
    execute.mockResolvedValue({ data: "x".repeat(20_000) })
    await runAgent(options)
    expect(JSON.stringify(generate.mock.calls[1][0].messages)).toContain("OUTPUT_TOO_LARGE")
  })
})
