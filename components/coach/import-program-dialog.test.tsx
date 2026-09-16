import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ImportProgramDialog } from "./import-program-dialog"
import { messages } from "@/lib/i18n/messages"
import type { ExerciseVariationOption } from "@/lib/fitness/types"

const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { id: "coach" } }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en }),
}))
vi.mock("@/lib/queries/coach-data", () => ({
  useCoachData: () => ({ data: { configured: true, connected: true }, setData: vi.fn() }),
  useCoachMutation: () => ({ mutateAsync: save }),
}))
vi.mock("./google-program-source", () => ({
  GoogleProgramSource: ({ onImport }: { onImport: (...args: unknown[]) => void }) => (
    <button onClick={() => onImport({
      spreadsheetId: "source-sheet",
      sheetName: "Week 1",
      rows: [{
        sourceRow: 2, exerciseName: "Bench", variationId: "bench", variationName: "",
        workoutName: "Push", scheduledDay: 1, sets: 3, reps: "8-12",
        restTime: 90, weight: 20, rir: 2, notes: "Imported note", method: "3:drop",
      }],
    }, "Imported program", 1)}>Load sheet fixture</button>
  ),
}))
vi.mock("@/components/exercises/add-exercise-modal", () => ({
  AddExerciseModal: ({ onPick, onClose }: {
    onPick: (option: { id: string }) => void; onClose: () => void
  }) => (
    <div>
      <button onClick={() => onPick({ id: "squat" })}>Pick Squat</button>
      <button onClick={onClose}>Close picker</button>
    </div>
  ),
}))

const options = ["bench", "squat"].map((id) => ({
  id, name: id === "bench" ? "Bench" : "Squat",
  exerciseName: id === "bench" ? "Bench" : "Squat",
  variationName: "Default", isDefault: true, muscleGroup: "chest", equipment: "barbell",
})) as ExerciseVariationOption[]

async function openReview() {
  render(<ImportProgramDialog open exerciseOptions={options} trainees={[]} onClose={vi.fn()} onImported={vi.fn()} />)
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Google Sheets" }), { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByText("Load sheet fixture"))
  await screen.findByLabelText("REST")
}

beforeEach(() => {
  save.mockReset()
  save.mockResolvedValue({ id: "program", name: "Imported program" })
})
afterEach(cleanup)

describe("import review exercise cards", () => {
  it("round-trips imported prescriptions and saves card edits with the source mapping", async () => {
    await openReview()
    expect(screen.getByLabelText("REST")).toHaveValue("90")
    expect(screen.getByLabelText("Add note")).toHaveValue("Imported note")
    expect(screen.getByLabelText("Reps")).toHaveValue("8-12")
    fireEvent.change(screen.getByLabelText("REST"), { target: { value: "120" } })
    fireEvent.change(screen.getByLabelText("Add note"), { target: { value: "Edited note" } })
    fireEvent.change(screen.getByLabelText("kg"), { target: { value: "22.5" } })
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0]).toMatchObject({
      googleSpreadsheetId: "source-sheet", googleSheetName: "Week 1",
      workouts: [{
        weekIndex: 0, scheduledDay: 1,
        exercises: [{
          variationId: "bench", sets: 3, repsMin: 8, reps: 12, weight: 22.5, rir: 2,
          restTime: 120, notes: "Edited note", setIntensityTags: [{ setNumber: 3, tag: "drop_set" }],
        }],
      }],
    })
  })

  it("preserves prescription on swap and removes methods on deleted sets", async () => {
    await openReview()
    fireEvent.change(screen.getByLabelText("Set"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Set"), { target: { value: "3" } })
    fireEvent.click(screen.getByRole("button", { name: "Swap exercise: Bench" }))
    fireEvent.click(screen.getByText("Pick Squat"))
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0].workouts[0].exercises[0]).toMatchObject({
      variationId: "squat", sets: 3, repsMin: 8, reps: 12, restTime: 90, notes: "Imported note",
    })
    expect(save.mock.calls[0][0][0].workouts[0].exercises[0].setIntensityTags).toBeUndefined()
  })

  it("saves a changed set method and treats a cleared rest field as unspecified", async () => {
    await openReview()
    fireEvent.keyDown(screen.getByRole("button", { name: "Set 1: Normal set" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitem", { name: /Warm-up/ }))
    fireEvent.change(screen.getByLabelText("REST"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0].workouts[0].exercises[0]).toMatchObject({
      restTime: undefined,
      setIntensityTags: [{ setNumber: 1, tag: "warmup" }, { setNumber: 3, tag: "drop_set" }],
    })
  })

  it("reorders cards without losing edits and allows adding after deleting the last exercise", async () => {
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }))
    fireEvent.click(screen.getByText("Pick Squat"))
    fireEvent.click(screen.getAllByRole("button", { name: /Move exercise down/ })[0])
    expect(screen.getAllByLabelText("Add note").map((input) => (input as HTMLInputElement).value)).toEqual(["", "Imported note"])
    fireEvent.click(screen.getAllByRole("button", { name: "Remove exercise" })[1])
    fireEvent.click(screen.getByRole("button", { name: "Remove exercise" }))
    expect(screen.getByRole("button", { name: "Create program" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }))
    fireEvent.click(screen.getByText("Pick Squat"))
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0].workouts[0].exercises).toEqual([
      expect.objectContaining({ variationId: "squat", sets: 3, reps: 10, restTime: 90 }),
    ])
  })
})
