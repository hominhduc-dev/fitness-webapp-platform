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
    backOffField: (field: string) => `Back-off sets ${field}`,
    backOffRow: (count: number) => `Back ×${count}`,
    intensityTagBackoff: "Back-off set",
    intensityTagTopSet: "Top set",
    collapseExercise: "Collapse exercise",
    expandExercise: "Expand exercise",
    intensityMethodLabel: "Method",
    intensityNormalSet: "Normal set",
    intensitySetChip: (setNumber: number) => `Set ${setNumber}`,
    intensitySetMethodLabel: (setNumber: number, method: string) => `Set ${setNumber}: ${method}`,
    removeExercise: "Remove exercise",
    repRange: "Rep range",
    reps: "Reps",
    set: "Set",
    swapExercise: "Swap exercise",
  },
} as unknown as AppMessages

const title = "Assisted triceps dip (kneeling)"

function renderCard(overrides: Partial<RoutineExerciseCardProps> = {}) {
  const props: RoutineExerciseCardProps = {
    // The card itself starts collapsed; most cases here exercise the open editor.
    defaultExpanded: true,
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
    expect(screen.queryByLabelText("Rep range")).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: `Collapse exercise: ${title}` })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Rep range")).toBeInTheDocument()
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

    fireEvent.change(screen.getByLabelText("Rep range"), { target: { value: "8-12" } })

    expect(props.onFieldChange).toHaveBeenCalledWith("reps", "8-12")
  })

  it("reports note edits from the compact note input", () => {
    const props = renderCard()

    fireEvent.change(screen.getByLabelText("Add note"), { target: { value: "Slow eccentric" } })

    expect(props.onFieldChange).toHaveBeenCalledWith("notes", "Slow eccentric")
  })

  it("can be controlled by the routine builder", () => {
    const onExpandedChange = vi.fn()
    renderCard({ expanded: true, onExpandedChange })

    fireEvent.click(screen.getByRole("button", { name: `Collapse exercise: ${title}` }))

    expect(onExpandedChange).toHaveBeenCalledWith(false)
    expect(screen.getByLabelText("Rep range")).toBeInTheDocument()
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

  describe("back-off row", () => {
    const topBackOff = [{ setNumber: 1, tag: "top_set" as const }, { setNumber: 2, tag: "back_off" as const }, { setNumber: 3, tag: "back_off" as const }]
    const values = { notes: "", reps: "6-8", restTime: "120", rir: "1", sets: "3", weight: "65" }

    it("shows only under a top set + back-off scheme, for the caller that can store it", () => {
      renderCard({ onBackOffChange: vi.fn(), onSetIntensityTagsChange: vi.fn(), setIntensityTags: [{ setNumber: 3, tag: "mrm" }], values })
      expect(screen.queryByLabelText("Back-off sets Rep range")).not.toBeInTheDocument()

      cleanup()
      renderCard({ onSetIntensityTagsChange: vi.fn(), setIntensityTags: topBackOff, values })
      expect(screen.queryByLabelText("Back-off sets Rep range")).not.toBeInTheDocument()

      cleanup()
      renderCard({ onBackOffChange: vi.fn(), onSetIntensityTagsChange: vi.fn(), setIntensityTags: topBackOff, values })
      expect(screen.getByText("Back ×2")).toBeInTheDocument()
    })

    it("follows the top set until changed, then sends the whole row", () => {
      const onBackOffChange = vi.fn()
      renderCard({ onBackOffChange, onSetIntensityTagsChange: vi.fn(), setIntensityTags: topBackOff, values })

      expect(screen.getByLabelText("Back-off sets Rep range")).toHaveValue("6-8")
      expect(screen.getByLabelText("Back-off sets kg")).toHaveValue(65)

      fireEvent.change(screen.getByLabelText("Back-off sets Rep range"), { target: { value: "5-10" } })
      expect(onBackOffChange).toHaveBeenCalledWith({ reps: "5-10", rir: "1", weight: "65" })
    })

    it("shows its own values once set", () => {
      renderCard({
        backOff: { reps: "5-10", rir: "2", weight: "50" },
        onBackOffChange: vi.fn(),
        onSetIntensityTagsChange: vi.fn(),
        setIntensityTags: topBackOff,
        values,
      })

      expect(screen.getByLabelText("Back-off sets Rep range")).toHaveValue("5-10")
      expect(screen.getByLabelText("Back-off sets kg")).toHaveValue(50)
      expect(screen.getByLabelText("Back-off sets RIR")).toHaveValue("2")
    })

    it("adds the back-off target to the collapsed summary", () => {
      expect(formatPrescriptionSummary(values, { reps: "5-10", rir: "2", weight: "50" })).toBe(
        "3 × 6-8 · 65 kg · RIR 1 · / 5-10 · 50 kg · 120s",
      )
    })
  })

  it("locks editing while saving but still lets the card collapse", () => {
    renderCard({ disabled: true })

    expect(screen.getByLabelText("Remove exercise")).toBeDisabled()
    expect(screen.getByLabelText("Rep range")).toBeDisabled()
    expect(screen.getByRole("button", { name: `Collapse exercise: ${title}` })).toBeEnabled()
  })
})
