import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionSetRow } from "./session-set-row"
import type { ExerciseSet } from "@/lib/types"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    messages: {
      workoutPage: {
        addNote: "Add note",
        hideNote: "Hide note",
        intensitySetMethodLabel: (set: number, method: string) => `Set ${set}: ${method}`,
        markIncomplete: "Mark incomplete",
        noteForSet: "Note",
        prevExceededHint: "Ready to increase weight",
        removeSet: "Remove set",
        reps: "Reps",
        setOptions: "Set options",
        weightInUnit: (unit: string) => `Weight in ${unit}`,
      },
    },
  }),
}))

const baseSet: ExerciseSet = {
  completed: false,
  id: "set-1",
  setNumber: 1,
  targetReps: 12,
}

afterEach(cleanup)

describe("SessionSetRow", () => {
  it("uses the program goal RIR suggestion as a placeholder without writing a value", () => {
    const onChange = vi.fn()
    render(
      <SessionSetRow
        active
        canRemove={false}
        onChange={onChange}
        onRemove={vi.fn()}
        programTarget={{ reps: 12, repsMin: 8, suggestedRir: 4 }}
        set={baseSet}
        setIndex={0}
        weightUnit="kg"
      />,
    )

    expect(screen.getByLabelText("RIR")).toHaveAttribute("placeholder", "4")
    expect(screen.getByLabelText("RIR")).toHaveValue(null)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("prefers the coach programmed RIR over the program goal suggestion", () => {
    render(
      <SessionSetRow
        active
        canRemove={false}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        programTarget={{ reps: 12, repsMin: 8, rir: 2, suggestedRir: 4 }}
        set={baseSet}
        setIndex={0}
        weightUnit="kg"
      />,
    )

    expect(screen.getByLabelText("RIR")).toHaveAttribute("placeholder", "2")
  })
})
