import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { formatPrescriptionSummary, RoutineExerciseCard, type RoutineExerciseCardProps } from "./routine-exercise-card"
import type { AppMessages } from "@/lib/i18n/messages"

const messages = {
  schedule: {
    moveExerciseDown: "Move exercise down",
    moveExerciseUp: "Move exercise up",
  },
  workoutPage: {
    addNote: "Add note",
    collapseExercise: "Collapse exercise",
    expandExercise: "Expand exercise",
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

const title = "Assisted triceps dip (kneeling)"

function renderCard(overrides: Partial<RoutineExerciseCardProps> = {}) {
  const props: RoutineExerciseCardProps = {
    index: 0,
    messages,
    meta: "Arms · Leverage machine",
    onFieldChange: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onSwap: vi.fn(),
    title,
    total: 2,
    values: { notes: "", reps: "10", restTime: "", rir: "", sets: "3", weight: "" },
    ...overrides,
  }

  render(<RoutineExerciseCard {...props} />)
  return props
}

afterEach(cleanup)

describe("formatPrescriptionSummary", () => {
  it("leaves out the fields the coach has not filled", () => {
    expect(formatPrescriptionSummary({ notes: "", reps: "8-12", restTime: "", rir: "", sets: "3", weight: "" })).toBe("3 × 8-12")
    expect(formatPrescriptionSummary({ notes: "", reps: "10", restTime: "90", rir: "2", sets: "4", weight: "20" })).toBe(
      "4 × 10 · 20 kg · RIR 2 · 90s",
    )
  })
})

describe("RoutineExerciseCard", () => {
  it("collapses to a one-line summary and expands on demand", () => {
    renderCard({ defaultExpanded: false, values: { notes: "", reps: "10", restTime: "90", rir: "", sets: "3", weight: "20" } })

    const toggle = screen.getByRole("button", { name: `Expand exercise: ${title}` })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("3 × 10 · 20 kg · 90s")).toBeInTheDocument()
    expect(screen.queryByLabelText("Reps")).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: `Collapse exercise: ${title}` })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Reps")).toBeInTheDocument()
    expect(screen.getByText("Arms · Leverage machine")).toBeInTheDocument()
  })

  it("swaps from the expanded toolbar", () => {
    const props = renderCard()

    fireEvent.click(screen.getByRole("button", { name: `Swap exercise: ${title}` }))

    expect(props.onSwap).toHaveBeenCalledOnce()
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

  it("shows prescribed method badges on the collapsed row", () => {
    renderCard({ defaultExpanded: false, onSetIntensityTagsChange: vi.fn(), setIntensityTags: [{ setNumber: 3, tag: "mrm" }] })

    expect(screen.getByText("MRM")).toBeInTheDocument()
  })

  it("locks editing while saving but still lets the card collapse", () => {
    renderCard({ disabled: true })

    expect(screen.getByLabelText("Remove exercise")).toBeDisabled()
    expect(screen.getByLabelText("Reps")).toBeDisabled()
    expect(screen.getByRole("button", { name: `Collapse exercise: ${title}` })).toBeEnabled()
  })
})
