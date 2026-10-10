import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { feedbackMessages } from "@/lib/i18n/messages/feedback"
import { version } from "@/package.json"
import { FeedbackForm } from "./feedback-form"

const api = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock("@/lib/feedback/api", () => ({ createFeedback: api.create }))
vi.mock("@/lib/queries/token", () => ({ requireAccessToken: async () => "test-token" }))
vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ messages: feedbackMessages.en, locale: "en" }) }))
vi.mock("@/components/admin/feedback-panel", () => ({ FeedbackPanel: () => null }))

afterEach(cleanup)
beforeEach(() => { api.create.mockReset(); api.create.mockResolvedValue({ id: "created" }); vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "") })

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><FeedbackForm /></QueryClientProvider>)
  fireEvent.click(screen.getByRole("button", { name: feedbackMessages.en.feedback.title }))
  return { invalidate }
}

describe("feedback submission", () => {
  it("sends only the internal pathname with app version, then resets the form and refreshes feedback", async () => {
    const { invalidate } = setup()
    fireEvent.change(screen.getByLabelText("Which page has the issue?"), { target: { value: "/workout?token=private#session" } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  Cannot finish my workout  " } })
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("test-token", expect.objectContaining({ pagePath: "/workout", appVersion: version, message: "Cannot finish my workout" })))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Feedback sent"))
    expect(screen.getByLabelText("Description")).toHaveValue("")
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["feedback"] })
  })

  it.each([
    ["danger.svg", "image/svg+xml", 10],
    ["large.png", "image/png", 1024 * 1024 + 1],
  ])("rejects an unsupported or oversized screenshot %s before any upload", (name, type, bytes) => {
    setup()
    const file = new File([new Uint8Array(bytes)], name, { type })
    fireEvent.change(screen.getByLabelText("Screenshot (optional)"), { target: { files: [file] } })
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PNG, JPEG or WebP image up to 1 MB")
    expect(api.create).not.toHaveBeenCalled()
  })

  it("blocks an external page path and leaves the user's description intact", () => {
    setup()
    fireEvent.change(screen.getByLabelText("Which page has the issue?"), { target: { value: "https://example.com/private" } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Cannot finish my workout" } })
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an internal path")
    expect(api.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Description")).toHaveValue("Cannot finish my workout")
  })
})
