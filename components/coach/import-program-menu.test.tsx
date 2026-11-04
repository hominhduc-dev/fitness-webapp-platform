import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { messages } from "@/lib/i18n/messages"
import { ImportProgramMenu } from "./import-program-menu"

const state = vi.hoisted(() => ({ configured: true }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ locale: "en", messages: messages.en }) }))
vi.mock("@/lib/queries/coach-data", () => ({ useCoachData: () => ({ data: { configured: state.configured } }) }))

beforeEach(() => {
  state.configured = true
  // Radix and React use the pointer type to distinguish hover from touch.
  class PointerEventStub extends MouseEvent {
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? "mouse"
    }
  }
  vi.stubGlobal("PointerEvent", PointerEventStub)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("program import source menu", () => {
  it("opens options on hover without opening an import flow, then selects the requested source", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ImportProgramMenu onSelect={onSelect} />)
    await user.hover(screen.getByRole("button", { name: "Import program" }))
    expect(await screen.findByRole("menuitem", { name: "From Excel" })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: "Google Sheets" })).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(screen.getByRole("menuitem", { name: "From image" }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("image")
  })

  it("supports keyboard opening and hides Google when it is not configured", async () => {
    state.configured = false
    const user = userEvent.setup()
    render(<ImportProgramMenu onSelect={vi.fn()} />)
    await user.tab()
    await user.keyboard("{ArrowDown}")
    expect(await screen.findByRole("menuitem", { name: "From Excel" })).toBeVisible()
    expect(screen.queryByRole("menuitem", { name: "Google Sheets" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("opens options with a touch without selecting a source", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ImportProgramMenu onSelect={onSelect} />)
    await user.pointer({ keys: "[TouchA]", target: screen.getByRole("button", { name: "Import program" }) })
    expect(await screen.findByRole("menuitem", { name: "From Excel" })).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
