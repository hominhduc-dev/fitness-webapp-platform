import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SlideToConfirm } from "./slide-to-confirm"

// jsdom has no layout: a 300px track with a 36px thumb leaves 256px to slide.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(36)
  HTMLElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderSlider(props: Partial<React.ComponentProps<typeof SlideToConfirm>> = {}) {
  const onConfirm = vi.fn()
  render(<SlideToConfirm label="Slide to finish" actionLabel="Finish workout" onConfirm={onConfirm} {...props} />)
  return { onConfirm, thumb: screen.getByRole("button", { name: "Finish workout" }) }
}

function slide(thumb: HTMLElement, to: number) {
  fireEvent.pointerDown(thumb, { pointerId: 1, button: 0, clientX: 0 })
  fireEvent.pointerMove(thumb, { pointerId: 1, clientX: to })
  fireEvent.pointerUp(thumb, { pointerId: 1, clientX: to })
}

describe("SlideToConfirm", () => {
  it("confirms once the thumb is slid most of the way", () => {
    const { onConfirm, thumb } = renderSlider()
    slide(thumb, 240)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("springs back without confirming when let go early", () => {
    const { onConfirm, thumb } = renderSlider()
    slide(thumb, 120)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(thumb.style.transform).toBe("translateX(0px)")
  })

  it("ignores a tap or mouse click but confirms from the keyboard", () => {
    const { onConfirm, thumb } = renderSlider()
    fireEvent.click(thumb, { detail: 1 })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(thumb, { detail: 0 })
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("does nothing while disabled", () => {
    const { onConfirm, thumb } = renderSlider({ disabled: true })
    slide(thumb, 256)
    fireEvent.click(thumb, { detail: 0 })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("says what unlocks it while disabled", () => {
    const onConfirm = vi.fn()
    render(
      <SlideToConfirm
        label="Slide to finish"
        actionLabel="Finish workout"
        disabledLabel="Log a set to finish"
        onConfirm={onConfirm}
        disabled
      />,
    )
    expect(screen.getByText("Log a set to finish")).toBeInTheDocument()
    expect(screen.queryByText("Slide to finish")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log a set to finish" })).toBeDisabled()
  })
})
