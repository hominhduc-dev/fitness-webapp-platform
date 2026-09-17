import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"

import { PullToRefresh } from "./pull-to-refresh"
import { renderWithProviders } from "@/lib/queries/test-utils"

/** jsdom has no Touch constructors, so the shape the handlers read is enough. */
function fireTouch(target: Element, type: "touchstart" | "touchmove" | "touchend", clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientY }] })
  // The listeners are native, so their setState lands outside React's batching.
  act(() => {
    target.dispatchEvent(event)
  })
}

function renderPull() {
  const { container } = renderWithProviders(
    <PullToRefresh>
      <div data-testid="page">page body</div>
      <div data-testid="handle" style={{ touchAction: "none" }}>
        drag me
      </div>
    </PullToRefresh>,
  )

  return container.querySelector("[aria-hidden]") as HTMLElement
}

afterEach(cleanup)

describe("PullToRefresh", () => {
  it("shows the spinner when the page itself is pulled down from the top", () => {
    const indicator = renderPull()

    fireTouch(screen.getByTestId("page"), "touchstart", 10)
    fireTouch(screen.getByTestId("page"), "touchmove", 90)

    expect(indicator.style.opacity).toBe("1")
  })

  it("stays out of the way when the pull starts on something that owns the gesture", () => {
    // The program editor's drag handle: dragging a session downwards used to
    // arm the pull as well, so the refresh spinner appeared mid-drag.
    const indicator = renderPull()

    fireTouch(screen.getByTestId("handle"), "touchstart", 10)
    fireTouch(screen.getByTestId("handle"), "touchmove", 90)

    expect(indicator.style.opacity).toBe("0")
  })
})
