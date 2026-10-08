import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  generate: vi.fn(), execute: vi.fn(), actor: vi.fn(),
  db: { agentRun: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() }, agentMemory: { findMany: vi.fn() },
    agentApproval: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() }, agentEvent: { findFirst: vi.fn(), create: vi.fn() },
    agentMessage: { create: vi.fn() }, agentConversation: { update: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock("../lib/prisma", () => ({ prisma: mocks.db }))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => ({ supportsTools: true, generateWithTools: mocks.generate }) }))
vi.mock("./security", () => ({ requireActor: mocks.actor }))
vi.mock("./tools/registry", () => ({ allowedTools: async () => [{ name: "read", description: "read", parameters: {} }],
  executeRegisteredTool: mocks.execute, getTool: () => ({ mode: "read", timeoutMs: 100 }) }))
import { processAgentRun } from "./worker"
import type { AIConversationMessage } from "../lib/ai/types"
let row: { id: string; status: string; leaseToken: string | null; conversationId: string; conversation: { actorId: string }; checkpoint: { messages: AIConversationMessage[]; startedAt: number }; steps: number; toolCalls: number; tokenUsage: number; attempts: number }
const call = { id: "one", name: "read", arguments: {} }
beforeEach(() => {
  vi.resetAllMocks()
  row = { id: "run", status: "running", leaseToken: "lease", conversationId: "conversation", conversation: { actorId: "actor" },
    checkpoint: { messages: [{ role: "user", content: "Analyze" }], startedAt: Date.now() }, steps: 0, toolCalls: 0, tokenUsage: 0, attempts: 1 }
  mocks.db.agentRun.findUnique.mockImplementation(async () => ({ ...row }))
  mocks.db.agentRun.findFirst.mockImplementation(async ({ where }) => row.status === where.status && row.leaseToken === where.leaseToken ? row : null)
  mocks.db.agentRun.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.status !== row.status || where.leaseToken !== row.leaseToken) return { count: 0 }
    Object.assign(row, data); return { count: 1 }
  })
  mocks.db.$transaction.mockImplementation(async fn => fn(mocks.db))
  mocks.db.agentMemory.findMany.mockResolvedValue([])
  mocks.db.agentApproval.findMany.mockResolvedValue([])
  mocks.db.agentApproval.count.mockResolvedValue(0)
  mocks.db.agentEvent.findFirst.mockResolvedValue(null)
  mocks.actor.mockResolvedValue({ id: "actor", role: "trainee" })
  mocks.execute.mockResolvedValue({ ok: true, score: 70 })
})
describe("persisted run processing", () => {
  it("checkpoints model calls before tools and persists the final message once", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "", toolCalls: [call], tokenUsage: 10 }).mockResolvedValueOnce({ text: "Readiness: 70", toolCalls: [], tokenUsage: 10 })
    await processAgentRun("run", "lease")
    expect(row.status).toBe("completed")
    expect(row.steps).toBe(2)
    expect(mocks.execute).toHaveBeenCalledWith({ actorId: "actor", runId: "run" }, call)
    const events = mocks.db.agentEvent.create.mock.calls.map(([args]) => args.data.type)
    expect(events.indexOf("model.completed")).toBeLessThan(events.indexOf("tool.started"))
    expect(mocks.db.agentMessage.create).toHaveBeenCalledTimes(1)
  })
  it("resumes an unresolved checkpoint without repeating the model decision", async () => {
    row.checkpoint.messages.push({ role: "assistant", content: "", toolCalls: [call] })
    row.steps = 1
    mocks.generate.mockResolvedValue({ text: "Done", toolCalls: [], tokenUsage: 10 })
    await processAgentRun("run", "lease")
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.generate.mock.calls[0][0].messages.some((item: AIConversationMessage) => item.role === "tool")).toBe(true)
  })
  it("reuses a durable tool result after restart instead of executing again", async () => {
    row.checkpoint.messages.push({ role: "assistant", content: "", toolCalls: [call] })
    mocks.db.agentEvent.findFirst.mockResolvedValue({ payload: { callId: "one", result: { ok: true, cached: true } } })
    mocks.generate.mockResolvedValue({ text: "Done", toolCalls: [], tokenUsage: 10 })
    await processAgentRun("run", "lease")
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].messages)).toContain("cached")
  })
  it("pauses for approval without generating a claim that writes succeeded", async () => {
    mocks.generate.mockResolvedValue({ text: "", toolCalls: [call], tokenUsage: 10 })
    mocks.db.agentApproval.count.mockResolvedValue(1)
    await processAgentRun("run", "lease")
    expect(row.status).toBe("waiting_approval")
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(mocks.db.agentMessage.create).not.toHaveBeenCalled()
  })
  it("blocks a batch beyond the call budget before dispatch", async () => {
    row.toolCalls = 19
    mocks.generate.mockResolvedValue({ text: "", toolCalls: [call, { ...call, id: "two" }], tokenUsage: 10 })
    await processAgentRun("run", "lease")
    expect(row.status).toBe("budget_exceeded")
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("does no work for a stale lease", async () => {
    await processAgentRun("run", "old-lease")
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("does not save a late tool result after cancellation", async () => {
    mocks.generate.mockResolvedValue({ text: "", toolCalls: [call], tokenUsage: 10 })
    mocks.execute.mockImplementation(async () => { row.status = "cancelled"; row.leaseToken = null; return { ok: true } })
    await processAgentRun("run", "lease")
    expect(row.status).toBe("cancelled")
    expect(mocks.db.agentMessage.create).not.toHaveBeenCalled()
    expect(mocks.db.agentEvent.create.mock.calls.some(([args]) => args.data.type === "tool.completed")).toBe(false)
  })
  it("does not expose provider error details in user messages", async () => {
    mocks.generate.mockRejectedValue(new Error("postgres://secret"))
    await processAgentRun("run", "lease")
    expect(row.status).toBe("failed")
    expect(JSON.stringify(mocks.db.agentMessage.create.mock.calls)).not.toContain("postgres://secret")
  })
})
