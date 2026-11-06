import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IntensityTagBadge, SetIntensityTagPicker } from "./set-intensity-tag"
import { getMessages } from "@/lib/i18n/messages"
import type { SetIntensityAssignment } from "@/lib/workout/intensity-tag"

const messages = getMessages("en")

afterEach(cleanup)

describe("IntensityTagBadge", () => {
  it("renders the short badge the trainee reads in the set row", () => {
    render(<IntensityTagBadge tag="mrm" />)

    expect(screen.getByText("MRM")).toBeInTheDocument()
  })
})

describe("SetIntensityTagPicker", () => {
  it("marks the active basic method and supports clearing it with keyboard-opened controls", () => {
    const onChange = vi.fn()
    render(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={2} value={[{ setNumber: 1, tag: "top_set" }]} />)
    fireEvent.keyDown(screen.getByLabelText("Set 1: Top set"), { key: "Enter" })
    expect(screen.getByRole("menuitemradio", { name: "Top set + back-off" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("menuitemradio", { name: "Warm-up" })).toHaveAttribute("aria-checked", "false")
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Normal set" }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("offers one combined method on set 1 and assigns every subsequent set back-off", () => {
    const onChange = vi.fn()
    const view = render(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={3} value={[{ setNumber: 3, tag: "mrm" }]} />)
    fireEvent.keyDown(screen.getByLabelText("Set 1: Normal set"), { key: "Enter" })
    expect(screen.queryByRole("menuitemradio", { name: "Top set" })).toBeNull()
    expect(screen.queryByRole("menuitemradio", { name: "Back-off set" })).toBeNull()
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Top set + back-off" }))
    const scheme = [{ setNumber: 1, tag: "top_set" }, { setNumber: 2, tag: "back_off" }, { setNumber: 3, tag: "back_off" }] as const
    expect(onChange).toHaveBeenCalledWith(scheme)
    view.rerender(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={3} value={[...scheme]} />)
    expect(screen.getByLabelText(/^Set 2: Back-off set/)).toBeDisabled()
    expect(screen.getByLabelText(/^Set 3: Back-off set/)).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText("Set 1: Top set"), { key: "Enter" })
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Normal set" }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it("leaves imported warm-up schemes intact and does not offer the combo on later sets", () => {
    const onChange = vi.fn()
    render(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={3} value={[{ setNumber: 1, tag: "warmup" }, { setNumber: 2, tag: "top_set" }, { setNumber: 3, tag: "back_off" }]} />)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText("Set 2: Top set"), { key: "Enter" })
    expect(screen.queryByRole("menuitemradio", { name: "Top set + back-off" })).toBeNull()
    expect(screen.queryByRole("menuitemradio", { name: "Back-off set" })).toBeNull()
    expect(screen.getByRole("menuitemradio", { name: "Drop set" })).toBeInTheDocument()
  })

  it("keeps all 100 set assignments when changing an earlier set", () => {
    const onChange = vi.fn()
    render(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={100} value={[{ setNumber: 100, tag: "back_off" }]} />)
    fireEvent.keyDown(screen.getByLabelText("Set 1: Normal set"), { key: "Enter" })
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Warm-up" }))
    expect(onChange).toHaveBeenCalledWith([{ setNumber: 1, tag: "warmup" }, { setNumber: 100, tag: "back_off" }])
  })

  it("locks method editing while saving", () => {
    render(<SetIntensityTagPicker messages={messages} onChange={vi.fn()} setCount={2} value={[]} disabled />)
    expect(screen.getByLabelText("Set 1: Normal set")).toBeDisabled()
    expect(screen.getByLabelText("Set 2: Normal set")).toBeDisabled()
  })

  it("shows compact numbered chips with a short badge and full accessible names", () => {
    render(
      <SetIntensityTagPicker
        messages={messages}
        onChange={vi.fn()}
        setCount={3}
        value={[{ setNumber: 3, tag: "mrm" }]}
      />,
    )

    expect(screen.getByLabelText("Set 1: Normal set")).toBeInTheDocument()
    expect(screen.getByLabelText("Set 3: Myo-rep match")).toBeInTheDocument()
    expect(screen.getByText("MRM")).toBeInTheDocument()
  })

  it("assigns the method the coach picks for that set", () => {
    const onChange = vi.fn<(assignments: SetIntensityAssignment[]) => void>()

    render(<SetIntensityTagPicker messages={messages} onChange={onChange} setCount={2} value={[]} />)
    // Radix opens the menu on pointerdown, which jsdom does not synthesise from
    // a click; the keyboard path exercises the same handler.
    fireEvent.keyDown(screen.getByLabelText("Set 2: Normal set"), { key: "Enter" })
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Drop set" }))

    expect(onChange).toHaveBeenCalledWith([{ setNumber: 2, tag: "drop_set" }])
  })

  it("drops a tag on a set the exercise no longer has", () => {
    render(
      <SetIntensityTagPicker
        messages={messages}
        onChange={vi.fn()}
        setCount={2}
        value={[{ setNumber: 4, tag: "mrm" }]}
      />,
    )

    expect(screen.queryByText("MRM")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Set 4/)).not.toBeInTheDocument()
  })
})
