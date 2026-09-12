import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ToastProvider, useToast } from "./toast-provider"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: { common: { dismissNotification: "Dismiss notification" } } }),
}))

function Harness() {
  const { dismissAll, toast } = useToast()

  return (
    <div>
      <button type="button" onClick={() => toast({ title: "Saved", tone: "success" })}>
        fire success
      </button>
      <button type="button" onClick={() => toast({ description: "no network", title: "Failed", tone: "error" })}>
        fire error
      </button>
      <button type="button" onClick={() => dismissAll()}>
        clear
      </button>
    </div>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("ToastProvider", () => {
  it("shows nothing until something fires a toast", () => {
    renderHarness()

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("lets any child fire one, and dismisses it on the close button", () => {
    renderHarness()
    fireEvent.click(screen.getByRole("button", { name: "fire error" }))

    const toast = screen.getByRole("alert")
    expect(toast).toHaveTextContent("Failed")
    expect(toast).toHaveTextContent("no network")

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("clears a success on its own but leaves an error standing", () => {
    vi.useFakeTimers()
    renderHarness()

    fireEvent.click(screen.getByRole("button", { name: "fire success" }))
    fireEvent.click(screen.getByRole("button", { name: "fire error" }))
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    // The success times out; the error names something to go and fix, so it waits.
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("keeps only the newest few, so a burst cannot bury the screen", () => {
    renderHarness()

    for (let click = 0; click < 5; click += 1) {
      fireEvent.click(screen.getByRole("button", { name: "fire error" }))
    }

    expect(screen.getAllByRole("alert")).toHaveLength(3)
  })
})
