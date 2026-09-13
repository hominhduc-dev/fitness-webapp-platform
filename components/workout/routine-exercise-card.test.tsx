import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RoutineExerciseCard, type RoutineExerciseCardProps } from "./routine-exercise-card"
import type { AppMessages } from "@/lib/i18n/messages"

const messages = {
  schedule: {
    moveExerciseDown: "Move exercise down",
    moveExerciseUp: "Move exercise up",
  },
  workoutPage: {
    addNote: "Add note",
    intensityMethodLabel: "Method",
    intensityNormalSet: "Normal set",
    intensitySetChip: (setNumber: number) => `Set ${setNumber}`,
    intensitySetMethodLabel: (setNumber: number, method: string) => `Set ${setNumber}: ${method}`,
    removeExercise: "Remove exercise",
    reps: "Reps",
    set: "Set",
    swapExercise: "Swap exercise",
  },
} as unknown as AppMessages

function renderCard(overrides: Partial<RoutineExerciseCardProps> = {}) {
  const props: RoutineExerciseCardProps = {
    index: 0,
    messages,
    meta: "Arms · Leverage machine",
    onFieldChange: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onSwap: vi.fn(),
    title: "Assisted triceps dip (kneeling)",
    total: 2,
    values: { notes: "", reps: "10", restTime: "", rir: "", sets: "3", weight: "" },
    ...overrides,
  }

  render(<RoutineExerciseCard {...props} />)
  return props
}

afterEach(cleanup)

describe("RoutineExerciseCard", () => {
  it("shows the full exercise name as the swap target", () => {
    const props = renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Swap exercise: Assisted triceps dip (kneeling)" }))

    expect(props.onSwap).toHaveBeenCalledOnce()
    expect(screen.getByText("Arms · Leverage machine")).toBeInTheDocument()
  })

  it("cannot move the first exercise up, but can move it down", () => {
    const props = renderCard()

    expect(screen.getByLabelText("Move exercise up")).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Move exercise down"))

    expect(props.onMove).toHaveBeenCalledWith(1)
  })

  it("reports prescription edits by field", () => {
    const props = renderCard()

    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "8-12" } })

    expect(props.onFieldChange).toHaveBeenCalledWith("reps", "8-12")
  })

  it("only offers per-set methods when the caller can store them", () => {
    renderCard()
    expect(screen.queryByText("Method")).not.toBeInTheDocument()

    cleanup()
    renderCard({ onSetIntensityTagsChange: vi.fn(), setIntensityTags: [] })
    expect(screen.getByLabelText("Set 3: Normal set")).toBeInTheDocument()
  })

  it("locks every control while saving", () => {
    renderCard({ disabled: true })

    expect(screen.getByLabelText("Remove exercise")).toBeDisabled()
    expect(screen.getByLabelText("Reps")).toBeDisabled()
  })
})
