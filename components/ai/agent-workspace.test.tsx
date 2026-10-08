import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
const mocks = vi.hoisted(() => ({ list: vi.fn(), conversation: vi.fn(), run: vi.fn(), create: vi.fn(), decide: vi.fn(), cancel: vi.fn(), memories: vi.fn(), save: vi.fn(), remove: vi.fn(), stream: vi.fn() }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: { id: "actor", role: "trainee" } }) }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ locale: "vi" }) }))
vi.mock("@/lib/queries/token", () => ({ requireAccessToken: async () => "test" }))
vi.mock("@/components/ai/ai-message", () => ({ AIMessage: ({ content }: { content: string }) => <p>{content}</p> }))
vi.mock("@/lib/fitness/api", () => ({ fetchAgentConversations: mocks.list, fetchAgentConversation: mocks.conversation, fetchAgentRun: mocks.run, createAgentRun: mocks.create,
  decideAgentApproval: mocks.decide, cancelAgentRun: mocks.cancel, fetchAgentMemories: mocks.memories, saveAgentMemory: mocks.save, deleteAgentMemory: mocks.remove, streamAgentEvents: mocks.stream }))
import { AgentWorkspace } from "./agent-workspace"
const approval = { id: "approval", kind: "program_changes", status: "pending", payloadHash: "reviewed-hash", payload: { programName: "Strength", reason: "Recovery", changes: [{ setId: "set", label: "Chest", before: { targetReps: 8, weight: 20, rir: 1 }, after: { targetReps: 8, weight: 22, rir: 1 } }] } }
beforeEach(() => {
  cleanup(); vi.resetAllMocks()
  mocks.list.mockResolvedValue([{ id: "conversation", title: "Review" }])
  mocks.conversation.mockResolvedValue({ id: "conversation", messages: [{ id: "message", role: "user", content: "Review my training" }], runs: [{ id: "run", status: "waiting_approval" }] })
  mocks.run.mockResolvedValue({ id: "run", status: "waiting_approval", approvals: [approval], reply: null })
  mocks.memories.mockResolvedValue([])
})
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}><AgentWorkspace /></QueryClientProvider>) }
describe("agent approval UI", () => {
  it("shows the before/after targets and passes the reviewed hash on approval", async () => {
    mount()
    await screen.findByText("Strength")
    expect(screen.getByText(/Tạ: 20/)).toBeInTheDocument()
    expect(screen.getByText(/Tạ: 22/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Duyệt thay đổi" }))
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith("test", "approval", "reviewed-hash", true))
  })
  it("rejects a proposal without applying it", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Từ chối" }))
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith("test", "approval", "reviewed-hash", false))
  })
  it("surfaces stale preview errors and keeps the proposal visible", async () => {
    mocks.decide.mockRejectedValue(new Error("Stale"))
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Duyệt thay đổi" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Program hoặc quyền truy cập có thể đã thay đổi")
    expect(screen.getByText("Strength")).toBeInTheDocument()
  })
  it("cancels an active run through the authenticated API", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Dừng lượt xử lý" }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith("test", "run"))
  })
  it("restores server-owned conversation history after mounting", async () => {
    mount(); expect(await screen.findByText("Review my training")).toBeInTheDocument()
    expect(mocks.conversation).toHaveBeenCalledWith("test", "conversation")
  })
})
