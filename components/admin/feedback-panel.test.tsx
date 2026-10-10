import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/auth/api"
import { feedbackMessages } from "@/lib/i18n/messages/feedback"
import { FeedbackPanel } from "./feedback-panel"

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/feedback/api", () => ({ listFeedback: api.list, getFeedback: api.detail, updateFeedback: api.update }))
vi.mock("@/lib/queries/token", () => ({ requireAccessToken: async () => "test-token" }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: { id: "admin-1" } }) }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ messages: { ...feedbackMessages.en, common: { loading: "Loading" } }, locale: "en" }) }))
// Keep domain interactions real while reducing Radix's portal/animation machinery.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="Select status or category" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null, SelectValue: () => null,
}))
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (value: boolean) => void }) => open ? <div role="dialog"><button onClick={() => onOpenChange(false)}>Close detail</button>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

const items = ["A", "B"].map((id) => ({ id, category: "bug", message: `Report ${id} cannot finish workout`, pagePath: "/workout", appVersion: "1.0", status: "new", createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z" }))
beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue({ items, total: 2, page: 1, limit: 10 })
  api.detail.mockImplementation(async (_token: string, id: string) => ({ ...items.find((item) => item.id === id), screenshot: null, userAgent: "Test browser" }))
})
afterEach(cleanup)
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><FeedbackPanel admin /></QueryClientProvider>)
}
async function startUpdate() {
  await screen.findByText(items[0].message)
  fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0])
  const dialog = await screen.findByRole("dialog")
  await within(dialog).findByText(items[0].message)
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "resolved" } })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save status" }))
  await waitFor(() => expect(api.update).toHaveBeenCalled())
}
describe("admin feedback decisions", () => {
  it("shows a concurrency conflict and keeps the detail available for another review", async () => {
    api.update.mockRejectedValue(new ApiError("stale", 409))
    setup(); await startUpdate()
    expect(await screen.findByRole("alert")).toHaveTextContent("This report changed. Reload it before updating.")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(api.update).toHaveBeenCalledWith("test-token", expect.objectContaining({ id: "A", updatedAt: items[0].updatedAt }), "resolved")
  })
  it("does not close report B when an earlier pending update for A finishes", async () => {
    let resolveUpdate!: (value: unknown) => void
    api.update.mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve }))
    setup(); await startUpdate()
    fireEvent.click(screen.getByRole("button", { name: "Close detail" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[1])
    await within(screen.getByRole("dialog")).findByText(items[1].message)
    await act(async () => { resolveUpdate({ ...items[0], status: "resolved" }) })
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent(items[1].message))
  })
})
