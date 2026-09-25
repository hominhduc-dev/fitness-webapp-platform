import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GlassSegmented } from "./glass-segmented"

const labels = ["Overview", "History", "Recovery"]

function renderTabs(props: { activeIndex: number; onSlide?: (index: number) => void; onSelect?: (index: number) => void }) {
  return render(
    <GlassSegmented activeIndex={props.activeIndex} columns={{ count: 3, gapPx: 4 }} onSlide={props.onSlide} data-testid="tabs">
      {(shownIndex) =>
        labels.map((label, index) => (
          <button key={label} type="button" data-segment data-shown={index === shownIndex} onClick={() => props.onSelect?.(index)}>
            {label}
          </button>
        ))
      }
    </GlassSegmented>,
  )
}

const lensOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[aria-hidden='true']")!

describe("GlassSegmented", () => {
  afterEach(cleanup)

  it("places the lens on the active column by CSS, so it is right before any measure", () => {
    const { container } = renderTabs({ activeIndex: 2 })

    // Two columns and two 4px gaps in; jsdom rewrites the calc(), so match its parts.
    expect(lensOf(container).style.left).toMatch(/^calc\(2 \* .*100% - 8px.* \+ 4px\)\)$/)
    expect(lensOf(container).style.width).toContain("100% - 8px")
    expect(lensOf(container).className).toContain("opacity-100")
  })

  it("tells the segments which one sits under the lens", () => {
    const { getByText } = renderTabs({ activeIndex: 1 })

    expect(getByText("History").dataset.shown).toBe("true")
    expect(getByText("Overview").dataset.shown).toBe("false")
  })

  it("hides the lens when nothing is active", () => {
    const { container } = renderTabs({ activeIndex: -1 })

    expect(lensOf(container).className).toContain("opacity-0")
  })

  it("replays the squish only when the lens moves, not on first paint", () => {
    const { container, rerender } = renderTabs({ activeIndex: 0 })
    const drop = () => lensOf(container).firstElementChild!

    expect(drop().className).not.toContain("glass-lens-squish")
    rerender(
      <GlassSegmented activeIndex={1} columns={{ count: 3, gapPx: 4 }}>
        {() => labels.map((label) => <button key={label} type="button" data-segment>{label}</button>)}
      </GlassSegmented>,
    )
    expect(drop().className).toContain("glass-lens-squish")
  })

  it("leaves a plain tap to the segment's own click", () => {
    const onSelect = vi.fn()
    const onSlide = vi.fn()
    const { getByText } = renderTabs({ activeIndex: 0, onSelect, onSlide })

    const history = getByText("History")
    fireEvent.pointerDown(history, { button: 0, clientX: 10, isPrimary: true, pointerId: 1 })
    fireEvent.pointerUp(history, { button: 0, clientX: 11, isPrimary: true, pointerId: 1 })
    fireEvent.click(history)

    expect(onSlide).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
