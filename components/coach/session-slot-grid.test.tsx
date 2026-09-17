import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { SessionSlotGrid, swapDaySlots, type SessionSlotView } from "./session-slot-grid"
import { messages } from "@/lib/i18n/messages"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en, setLocale: vi.fn() }),
}))

const session: SessionSlotView = { exerciseCount: 2, kind: "session", name: "Day 1", tag: "push" }
const rest: SessionSlotView = { kind: "rest" }
const empty: SessionSlotView = { kind: "empty" }

afterEach(cleanup)

describe("swapDaySlots", () => {
  it("trades a session with the rest day it is dropped on", () => {
    expect(swapDaySlots([session, rest, empty], 0, 1)).toEqual([rest, session, empty])
  })

  it("swaps two sessions rather than overwriting one", () => {
    const other: SessionSlotView = { exerciseCount: 3, kind: "session", name: "Day 2", tag: "pull" }

    expect(swapDaySlots([session, other], 1, 0)).toEqual([other, session])
  })

  it("leaves the week alone for a no-op or out-of-range drop", () => {
    const week = [session, rest]

    expect(swapDaySlots(week, 1, 1)).toBe(week)
    expect(swapDaySlots(week, 0, 5)).toBe(week)
  })
})

describe("SessionSlotGrid", () => {
  function renderGrid(views: SessionSlotView[], overrides: Partial<Parameters<typeof SessionSlotGrid>[0]> = {}) {
    const props = {
      dayLabels: ["Mon", "Tue", "Wed"],
      onEdit: vi.fn(),
      onMove: vi.fn(),
      onOpen: vi.fn(),
      onToggleRest: vi.fn(),
      views,
      ...overrides,
    }

    render(<SessionSlotGrid {...props} />)
    return props
  }

  const handleName = messages.en.coach.moveSessionHint

  it("offers a drag handle only on days that hold a session", () => {
    renderGrid([session, rest, empty])

    expect(screen.getAllByTitle(handleName)).toHaveLength(1)
  })

  it("does not open the day picker when the handle itself is pressed", () => {
    const props = renderGrid([session, rest, empty])

    fireEvent.click(screen.getByTitle(handleName))

    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it("opens the day when the card body is pressed", () => {
    const props = renderGrid([session, rest, empty])

    fireEvent.click(screen.getByText("Day 1"))

    expect(props.onOpen).toHaveBeenCalledWith(0)
  })

  it("drops the handle while the program is read-only", () => {
    renderGrid([session, rest, empty], { disabled: true })

    expect(screen.queryByTitle(handleName)).not.toBeInTheDocument()
  })
})
