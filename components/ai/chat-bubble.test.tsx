import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AIChatPanel } from "./chat-bubble"
const state = vi.hoisted(() => ({ profile: { id: "trainee-1", role: "trainee" }, send: vi.fn() }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: state.profile }) }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ locale: "en" }) }))
vi.mock("@/lib/queries/ai", () => ({ useSendAIChatMessage: () => ({ mutateAsync: state.send, isPending: false }) }))
vi.mock("@/components/ai/agent-workspace", () => ({ AgentWorkspace: () => <div>Agent workspace</div> }))
vi.mock("@/components/ai/ai-message", () => ({ AIMessage: ({ content }: { content: string }) => <span>{content}</span> }))
vi.mock("@/components/ai/chat-program-card", () => ({ ChatProgramCard: () => <div>Program draft</div> }))
vi.mock("@/components/ai/chat-meal-plan-card", () => ({ ChatMealPlanCard: () => <div>Meal draft</div> }))
describe("shared AI chat", () => {
  afterEach(cleanup)
  beforeEach(() => {
    state.profile = { id: "trainee-1", role: "trainee" }
    state.send.mockReset().mockResolvedValue({ reply: "Helpful answer" })
    Element.prototype.scrollIntoView = vi.fn()
  })
  it("retains trainee actions and sends plain transcript", async () => {
    render(<AIChatPanel />)
    expect(screen.getByRole("link", { name: "Create a workout program" }).getAttribute("href")).toBe("/workout/ai-generate")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Training question" } })
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))
    await screen.findByText("Helpful answer")
    expect(state.send).toHaveBeenCalledWith(["Training question", []])
  })
  it("gives coach coach routes and retains Agent workspace", () => {
    state.profile = { id: "coach-1", role: "coach" }
    render(<AIChatPanel />)
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("href")).toBe("/coach/trainees")
    expect(screen.queryByRole("link", { name: "Create a workout program" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "AI Agent" }))
    expect(screen.getByText("Agent workspace")).toBeTruthy()
  })
  it("clears drafts and ignores old replies when account changes", async () => {
    let resolve!: (value: { reply: string }) => void
    state.send.mockReturnValue(new Promise((done) => { resolve = done }))
    const view = render(<AIChatPanel />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Private question" } })
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))
    state.profile = { id: "coach-2", role: "coach" }
    view.rerender(<AIChatPanel />)
    resolve({ reply: "Private reply" })
    await waitFor(() => expect(screen.queryByText("Private reply")).toBeNull())
    expect(screen.queryByText("Private question")).toBeNull()
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("")
  })
  it("uses a mobile full-page viewport and follows keyboard viewport changes", () => {
    const viewport = Object.assign(new EventTarget(), { height: 900, offsetTop: 0 })
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport })
    const remove = vi.spyOn(viewport, "removeEventListener")
    const view = render(<AIChatPanel />)
    const panel = screen.getByLabelText("AI Coach")
    expect(panel.className).toContain("fixed left-0 right-0")
    expect(panel.className).not.toContain(" min-h-[")
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/dashboard")
    expect(panel.style.getPropertyValue("--chat-viewport-height")).toBe("900px")
    viewport.height = 480
    viewport.offsetTop = 24
    viewport.dispatchEvent(new Event("resize"))
    expect(panel.style.getPropertyValue("--chat-viewport-height")).toBe("480px")
    expect(panel.style.getPropertyValue("--chat-viewport-top")).toBe("24px")
    view.unmount()
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function))
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function))
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined })
  })

})
