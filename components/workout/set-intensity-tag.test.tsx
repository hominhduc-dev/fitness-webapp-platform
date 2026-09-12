import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IntensityTagBadge, SetIntensityTagPicker } from "./set-intensity-tag"
import type { AppMessages } from "@/lib/i18n/messages"
import type { SetIntensityAssignment } from "@/lib/workout/intensity-tag"

const messages = {
  workoutPage: {
    intensityMethodLabel: "Method",
    intensityNormalSet: "Normal set",
    intensitySetChip: (setNumber: number) => `Set ${setNumber}`,
    intensitySetMethodLabel: (setNumber: number, method: string) => `Set ${setNumber}: ${method}`,
    intensityTagCluster: "Cluster",
    intensityTagDropSet: "Drop set",
    intensityTagFailure: "To failure",
    intensityTagMrm: "Myo-rep match",
    intensityTagRestPause: "Rest-pause",
    intensityTagWarmup: "Warm-up",
  },
} as unknown as AppMessages

afterEach(cleanup)

describe("IntensityTagBadge", () => {
  it("renders the short badge the trainee reads in the set row", () => {
    render(<IntensityTagBadge tag="mrm" />)

    expect(screen.getByText("MRM")).toBeInTheDocument()
  })
})

describe("SetIntensityTagPicker", () => {
  it("shows one chip per set and marks the tagged one", () => {
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
    fireEvent.click(screen.getByText("Drop set"))

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
