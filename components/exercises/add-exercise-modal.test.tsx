import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AddExerciseModal } from "./add-exercise-modal"
import { messages } from "@/lib/i18n/messages"
import type { ExerciseVariationOption } from "@/lib/types"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en }),
}))

const exercises = ["Bench", "Squat", "Row"].map((name) => ({
  id: name, name, exerciseId: name, exerciseName: name, variationName: "Default", sortOrder: 0,
  muscleGroup: "chest", equipment: "Barbell",
  isDefault: true, activityType: "strength", primaryMuscles: [], secondaryMuscles: [],
})) as ExerciseVariationOption[]

function setup(multiple = true, existingVariationIds: string[] = []) {
  const onPick = vi.fn()
  const onPickMany = vi.fn()
  const onClose = vi.fn()
  render(<AddExerciseModal exercises={exercises} existingVariationIds={existingVariationIds}
    onPick={onPick} onPickMany={multiple ? onPickMany : undefined} onClose={onClose} />)
  return { onPick, onPickMany, onClose }
}
afterEach(cleanup)

describe("multi-exercise picker", () => {
  it("stages selections across search and submits in selection order only on Create", () => {
    const callbacks = setup()
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Squat/ }))
    fireEvent.change(screen.getByPlaceholderText(messages.en.workoutPage.searchShortPlaceholder), { target: { value: "Bench" } })
    fireEvent.click(screen.getByRole("button", { name: /Bench/ }))
    expect(callbacks.onClose).not.toHaveBeenCalled()
    expect(callbacks.onPick).not.toHaveBeenCalled()
    expect(callbacks.onPickMany).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Add 2 exercises" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Create" }))
    expect(callbacks.onPickMany).toHaveBeenCalledWith([exercises[1], exercises[0]])
    expect(callbacks.onClose).toHaveBeenCalledOnce()
  })

  it("toggles selections, prevents duplicates and confirms from the footer", () => {
    const callbacks = setup(true, ["Row"])
    expect(screen.getByRole("button", { name: /Row/ })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Bench/ }))
    expect(screen.getByRole("button", { name: /Bench/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: /Bench/ }))
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Squat/ }))
    fireEvent.click(screen.getByRole("button", { name: "Add 1 exercise" }))
    expect(callbacks.onPickMany).toHaveBeenCalledWith([exercises[1]])
  })

  it("discards unconfirmed selections when cancelled", () => {
    const callbacks = setup()
    fireEvent.click(screen.getByRole("button", { name: /Bench/ }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(callbacks.onPickMany).not.toHaveBeenCalled()
    expect(callbacks.onPick).not.toHaveBeenCalled()
    expect(callbacks.onClose).toHaveBeenCalledOnce()
  })

  it("preserves immediate single selection for swap and other existing callers", () => {
    const callbacks = setup(false)
    fireEvent.click(screen.getByRole("button", { name: /Bench/ }))
    expect(callbacks.onPick).toHaveBeenCalledWith(exercises[0])
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument()
  })
})
