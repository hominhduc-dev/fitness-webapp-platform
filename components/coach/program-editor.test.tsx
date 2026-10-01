import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProgramEditor } from "./program-editor"
import { getProgramDraftStorageKey, readProgramDraft, writeProgramDraft } from "./program-draft-storage"
import { messages } from "@/lib/i18n/messages"
import type { CoachProgram, ExerciseVariationOption } from "@/lib/fitness/types"

const { save } = vi.hoisted(() => ({ save: vi.fn() }))

const program = {
  assignedTo: [],
  assignedTrainees: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  createdBy: "coach",
  description: "",
  difficulty: "beginner",
  duration: 1,
  goal: "hypertrophy",
  id: "program-1",
  name: "Bulking",
  workouts: [
    {
      exercises: [
        {
          exercise: { id: "bench", muscleGroup: "chest", name: "Bench" },
          id: "we-1",
          restTime: 90,
          sets: [{ rir: 2, targetReps: 10, weight: 50 }],
          variation: { equipment: "barbell", id: "bench-default", isDefault: true, name: "Default" },
        },
      ],
      id: "workout-1",
      name: "Push",
      scheduledDay: 1,
      weekIndex: 0,
    },
  ],
  workoutsPerWeek: 3,
} as unknown as CoachProgram

const exerciseOptions = [
  { equipment: "barbell", exerciseId: "bench", exerciseName: "Bench", id: "bench-default", isDefault: true, muscleGroup: "chest", name: "Bench", variationName: "Default" },
] as ExerciseVariationOption[]

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ isLoading: false, profile: { id: "coach" }, session: { access_token: "token" } }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en }),
}))
vi.mock("@/lib/queries/coach-data", () => ({
  useCoachData: (queryKey: unknown[]) =>
    queryKey.includes("program-1")
      ? { data: program, error: null, isPending: false }
      : { data: [], error: null, isPending: false },
  useCoachMutation: () => ({ mutateAsync: save }),
}))
vi.mock("@/lib/queries/exercises", () => ({
  useCreateExerciseFromPicker: () => ({ mutateAsync: vi.fn() }),
  useExercises: () => ({ data: exerciseOptions, isFetching: false }),
  useUpdateExerciseFromPicker: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock("@/lib/queries/workouts", () => ({
  useCreateWorkout: () => ({ mutateAsync: vi.fn() }),
  useUpdateWorkout: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock("@/components/exercises/add-exercise-modal", () => ({ AddExerciseModal: () => null }))
vi.mock("@/components/body/muscle-map-pair", () => ({ MuscleMapPair: () => null }))
vi.mock("./session-slot-grid", () => ({
  SessionSlotGrid: ({ onEdit, views }: { onEdit: (dayIndex: number) => void; views: Array<{ kind: string }> }) => (
    <div>
      <button type="button" onClick={() => onEdit(0)}>Edit Monday</button>
      <ol aria-label="Week days">
        {views.map((view, dayIndex) => <li key={dayIndex}>{view.kind}</li>)}
      </ol>
    </div>
  ),
  swapDaySlots: <T,>(slots: T[]) => slots,
}))

const storageKey = getProgramDraftStorageKey("coach", "program-1")
const coach = messages.en.coach

function renderEditor() {
  return render(<ProgramEditor programId="program-1" initialExerciseOptions={exerciseOptions} onClose={vi.fn()} onSaved={vi.fn()} />)
}

function programNameInput() {
  return screen.getByPlaceholderText(coach.programNamePlaceholder)
}

async function openMonday() {
  fireEvent.click(screen.getByRole("button", { name: "Edit Monday" }))
  return screen.findByPlaceholderText(messages.en.workoutPage.routineNamePlaceholder)
}

async function closeDialogWithoutSaving() {
  fireEvent.click(screen.getByRole("button", { name: messages.en.common.cancel, hidden: false }))
  await waitFor(() => expect(screen.queryByPlaceholderText(messages.en.workoutPage.routineNamePlaceholder)).toBeNull())
}

beforeEach(() => {
  save.mockReset()
  save.mockResolvedValue(program)
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("program editor schedule", () => {
  it("shows the days of a week with sessions but no workout as rest days, not empty slots", () => {
    renderEditor()
    // Three days a week puts Mon, Wed and Fri in the pattern; only Monday has a session.
    const days = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(days).toEqual(["session", "rest", "rest", "rest", "rest", "rest", "rest"])
  })
})

describe("program editor unsaved draft", () => {
  it("keeps program edits after the editor is closed without saving", async () => {
    const first = renderEditor()
    fireEvent.change(programNameInput(), { target: { value: "Bulking v2" } })
    expect(readProgramDraft(storageKey)?.form.programName).toBe("Bulking v2")
    first.unmount()

    renderEditor()
    expect(programNameInput()).toHaveValue("Bulking v2")
    expect(screen.getByText(/Restored your unsaved changes/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: coach.discardProgramDraft }))
    expect(programNameInput()).toHaveValue("Bulking")
    expect(readProgramDraft(storageKey)).toBeNull()
  })

  it("writes nothing while the form still matches the saved program", () => {
    renderEditor()
    fireEvent.change(programNameInput(), { target: { value: "Bulking v2" } })
    fireEvent.change(programNameInput(), { target: { value: "Bulking" } })
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })

  it("keeps a day's edits when its dialog is closed without saving, across reopening and reloads", async () => {
    const first = renderEditor()
    fireEvent.change(await openMonday(), { target: { value: "Push heavy" } })
    await closeDialogWithoutSaving()

    // Reopening the same day shows the unsaved fields.
    expect(await openMonday()).toHaveValue("Push heavy")
    expect(screen.getByText(coach.routineDraftRestored)).toBeInTheDocument()
    await closeDialogWithoutSaving()
    first.unmount()

    // So does a new editor, after the page was left or reloaded.
    renderEditor()
    expect(await openMonday()).toHaveValue("Push heavy")
    fireEvent.click(screen.getByRole("button", { name: coach.revertRoutineDraft }))
    expect(screen.getByPlaceholderText(messages.en.workoutPage.routineNamePlaceholder)).toHaveValue("Push")
    await waitFor(() => expect(readProgramDraft(storageKey)).toBeNull())
  })

  it("moves a saved day into the program draft and clears everything once the program is saved", async () => {
    renderEditor()
    fireEvent.change(await openMonday(), { target: { value: "Push heavy" } })
    fireEvent.click(screen.getByRole("button", { name: messages.en.workoutPage.saveChanges }))

    await waitFor(() => expect(readProgramDraft(storageKey)?.routineDrafts).toEqual({}))
    expect(readProgramDraft(storageKey)?.form.schedule[0]?.[0]?.routine?.name).toBe("Push heavy")

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: messages.en.common.saveChanges }))
    })
    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0][1].workouts[0].name).toBe("Push heavy")
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })

  it("asks before restoring a draft edited before the program was saved again", () => {
    writeProgramDraft(storageKey, {
      form: {
        description: "", difficulty: "beginner", duration: "1", programGoal: "hypertrophy",
        programName: "Old draft name", routineLibrary: [], schedule: [[null, null, null, null, null, null, null]],
        selectedTraineeIds: [], startDate: "",
      },
      routineDrafts: {},
      savedAt: "2026-09-29T08:00:00.000Z",
      serverVersion: "an-older-version",
    })

    renderEditor()
    expect(programNameInput()).toHaveValue("Bulking")
    expect(screen.getByText(/has been saved again since then/)).toBeInTheDocument()
    // The waiting draft is not overwritten by the editor's own writes.
    fireEvent.change(programNameInput(), { target: { value: "Bulking v3" } })
    expect(readProgramDraft(storageKey)?.form.programName).toBe("Old draft name")

    fireEvent.click(screen.getByRole("button", { name: coach.restoreProgramDraft }))
    expect(programNameInput()).toHaveValue("Old draft name")
    expect(screen.getByText(/Restored your unsaved changes/)).toBeInTheDocument()
  })
})
