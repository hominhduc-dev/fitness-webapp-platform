import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AddExerciseModal } from "./add-exercise-modal"
import { messages } from "@/lib/i18n/messages"
import type { ExerciseVariationOption } from "@/lib/types"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en }),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { id: "coach-1" } }),
}))
vi.mock("@/components/admin/admin-exercises-panel", () => ({
  // The picker loads the form on demand; this stub saves it with a new name.
  ExerciseFormModal: ({ initial, onSave }: { initial: { id: string; name: string } | null; onSave: (data: object) => void }) => (
    <button type="button" onClick={() => onSave({ id: initial?.id, name: "Cable Fly Over" })}>
      Save form for {initial?.name}
    </button>
  ),
}))
vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
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

describe("creating an exercise from the picker", () => {
  it("is offered only when the caller can create, prefilled with the search", () => {
    setup(false)
    expect(screen.queryByRole("button", { name: /Create a new exercise/ })).not.toBeInTheDocument()
    cleanup()

    render(<AddExerciseModal exercises={exercises} existingVariationIds={[]} onPick={vi.fn()} onClose={vi.fn()}
      createExercise={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Create a new exercise/ })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(messages.en.workoutPage.searchShortPlaceholder), { target: { value: "Tempo Squat" } })
    expect(screen.getByRole("button", { name: /Create "Tempo Squat"/ })).toBeInTheDocument()
  })
})

describe("a coach's own exercises", () => {
  const own = {
    ...exercises[0], canManage: true, createdById: "coach-1", exerciseId: "fly-exercise",
    exerciseName: "Fly Over", id: "fly", name: "Fly Over", source: "coach",
  } as ExerciseVariationOption
  const ownShared = { ...own, canManage: false, exerciseId: "press-exercise", exerciseName: "Tempo Press", id: "press", name: "Tempo Press" }
  const otherCoach = { ...own, canManage: false, createdById: "coach-2", exerciseId: "curl-exercise", exerciseName: "Spider Curl", id: "curl", name: "Spider Curl" }
  const catalogue = [...exercises, own, ownShared, otherCoach]

  function renderCoachPicker(updateExercise = vi.fn(), onExerciseUpdated = vi.fn()) {
    render(<AddExerciseModal exercises={catalogue} existingVariationIds={[]} onPick={vi.fn()} onClose={vi.fn()}
      createExercise={vi.fn()} updateExercise={updateExercise} onExerciseUpdated={onExerciseUpdated} />)
    return { onExerciseUpdated, updateExercise }
  }

  it("lists only the exercises the coach created under My exercises", () => {
    renderCoachPicker()
    const mine = screen.getByRole("tab", { name: "My exercises (2)" })
    expect(screen.getByRole("button", { name: /Spider Curl/ })).toBeInTheDocument()

    fireEvent.click(mine)
    expect(mine).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: /^Fly Over/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Tempo Press/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Spider Curl/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Bench/ })).not.toBeInTheDocument()
  })

  it("says so when the coach has none yet", () => {
    render(<AddExerciseModal exercises={exercises} existingVariationIds={[]} onPick={vi.fn()} onClose={vi.fn()} createExercise={vi.fn()} />)
    fireEvent.click(screen.getByRole("tab", { name: "My exercises (0)" }))
    expect(screen.getByText(messages.en.workoutPage.noMyExercises)).toBeInTheDocument()
  })

  it("has no tabs for a picker that cannot create exercises", () => {
    setup(false)
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("edits only the coach's own exercises that are not shared yet", async () => {
    const edited = { ...own, displayName: "Cable Fly Over", exerciseName: "Cable Fly Over", name: "Cable Fly Over" }
    const { onExerciseUpdated, updateExercise } = renderCoachPicker(vi.fn().mockResolvedValue(edited))
    expect(screen.queryByRole("button", { name: "Edit exercise: Tempo Press" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit exercise: Spider Curl" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit exercise: Fly Over" }))
    // By text: the stub renders beside the picker dialog, which Radix hides from the role tree.
    fireEvent.click(await screen.findByText("Save form for Fly Over"))

    await waitFor(() => expect(onExerciseUpdated).toHaveBeenCalledWith(edited))
    expect(updateExercise).toHaveBeenCalledWith("fly-exercise", expect.objectContaining({ name: "Cable Fly Over" }))
    expect(screen.getByRole("button", { name: /^Cable Fly Over/ })).toBeInTheDocument()
  })
})
