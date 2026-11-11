import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ImportProgramDialog } from "./import-program-dialog"
import { messages } from "@/lib/i18n/messages"
import type { CoachTrainee, CreateCoachProgramInput, ExerciseVariationOption } from "@/lib/fitness/types"

const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { id: "coach" } }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en }),
}))
vi.mock("@/lib/queries/coach-data", () => ({
  useCoachData: () => ({ data: { configured: true, connected: true }, setData: vi.fn() }),
  useCoachMutation: () => ({ isPending: false, mutateAsync: save, reset: vi.fn() }),
}))
vi.mock("@/lib/images/downscale", () => ({
  downscaleImage: async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("not an image")
    return { data: "aW1hZ2U=", mediaType: "image/jpeg" }
  },
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

const trainees = [
  { id: "trainee-1", name: "Minh Duc", email: "duc@example.com", fitnessGoals: [], createdAt: new Date(), programCount: 0, thisWeekWorkouts: 0, totalWorkoutLogs: 0 },
  { id: "trainee-2", name: "Lan Anh", email: "lan@example.com", fitnessGoals: [], createdAt: new Date(), programCount: 0, thisWeekWorkouts: 0, totalWorkoutLogs: 0 },
] as CoachTrainee[]

async function openReview() {
  render(<ImportProgramDialog open exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Google Sheets" }), { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByText("Load sheet fixture"))
  await screen.findByRole("button", { name: "Expand exercise: Bench" })
}

/** Imported cards land collapsed, so editing one starts by opening it. */
async function expandImportedCard() {
  fireEvent.click(await screen.findByRole("button", { name: "Expand exercise: Bench" }))
  await screen.findByLabelText("REST")
}

beforeEach(() => {
  window.localStorage.clear()
  save.mockReset()
  save.mockResolvedValue({ id: "program", name: "Imported program" })
})
afterEach(cleanup)

describe("import source selection", () => {
  const DRAFT_KEY = "yeahbuddy:program-import-draft:coach"
  it("opens directly on the selected source", () => {
    render(<ImportProgramDialog open initialSource="image" exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
    expect(screen.getByRole("tab", { name: "From image" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("heading", { name: "Create a program from an image" })).toBeInTheDocument()
  })

  it("keeps a saved review when selecting another source without restoring the wrong flow", async () => {
    await openReview()
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull())
    const saved = window.localStorage.getItem(DRAFT_KEY)
    cleanup()
    render(<ImportProgramDialog open initialSource="image" exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
    expect(screen.getByRole("tab", { name: "From image" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(DRAFT_KEY)).toBe(saved)
  })
})

describe("import review exercise cards", () => {
  it("round-trips imported prescriptions and saves card edits with the source mapping", async () => {
    await openReview()
    await expandImportedCard()
    expect(screen.getByLabelText("REST")).toHaveValue("90")
    expect(screen.getByLabelText("Add note")).toHaveValue("Imported note")
    expect(screen.getByLabelText("Rep range")).toHaveValue("8-12")
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
    await expandImportedCard()
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
    await expandImportedCard()
    fireEvent.keyDown(screen.getByRole("button", { name: "Set 1: Normal set" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Warm-up" }))
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
    await expandImportedCard()
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

describe("import review program details", () => {
  it("keeps imported cards collapsed and opens the one the coach adds", async () => {
    await openReview()

    // Collapsed: the summary stands in for the prescription fields.
    expect(screen.queryByLabelText("REST")).not.toBeInTheDocument()
    expect(screen.getByText("3 × 8-12 · 20 kg · RIR 2 · 90s")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }))
    fireEvent.click(screen.getByText("Pick Squat"))

    expect(screen.getByLabelText("REST")).toHaveValue("90")
    expect(screen.getByRole("button", { name: "Collapse exercise: Squat" })).toBeInTheDocument()
  })

  it("saves the start date, focus and roster picked in the form", async () => {
    await openReview()

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-05" } })
    fireEvent.change(screen.getByLabelText("Training focus"), { target: { value: "Push volume block" } })
    // The disclosure header carries its summary line into the accessible name.
    fireEvent.click(screen.getByRole("button", { name: /Assign trainee/ }))
    // One trainee per program: the roster is a radio group.
    fireEvent.click(await screen.findByRole("radio", { name: /Minh Duc/ }))
    expect(screen.getByRole("radio", { name: /Minh Duc/ })).toHaveAttribute("aria-checked", "true")

    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0]).toMatchObject({
      assignToUserIds: ["trainee-1"],
      description: "Push volume block",
      startDate: "2026-10-05",
    })
  })

  it("sends no start date when the coach leaves it blank", async () => {
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0]).toMatchObject({ assignToUserIds: [], startDate: null })
  })
})

describe("reviewing an AI draft", () => {
  const aiDraft = {
    generationId: "generation-1",
    goal: "strength",
    program: {
      description: "Four weeks of heavy work",
      difficulty: "advanced",
      duration: 2,
      name: "AI strength block",
      workoutsPerWeek: 1,
      workouts: [0, 1].map((weekIndex) => ({
        duration: 60,
        exercises: [{ reps: 5, restTime: 180, rir: 2, sets: 4, variationId: "squat", weight: 100 }],
        kind: "legs",
        name: "Legs",
        scheduledDay: 1,
        weekIndex,
      })),
    },
    traineeId: "trainee-2",
  }

  it("opens on Review with the draft and saves it as that draft, edits included", async () => {
    render(<ImportProgramDialog open aiDraft={aiDraft} exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)

    // No upload step: the draft is already on Review, for its trainee, and cannot go back.
    expect(await screen.findByDisplayValue("AI strength block")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Back/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Assign trainee.*Lan Anh/ })).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue("AI strength block"), { target: { value: "Edited block" } })
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0][0]).toMatchObject({
      aiGenerationId: "generation-1",
      assignToUserIds: ["trainee-2"],
      description: "Four weeks of heavy work",
      difficulty: "advanced",
      duration: 2,
      goal: "strength",
      name: "Edited block",
      workouts: [
        { exercises: [{ reps: 5, restTime: 180, rir: 2, sets: 4, variationId: "squat", weight: 100 }], scheduledDay: 1, weekIndex: 0 },
        { scheduledDay: 1, weekIndex: 1 },
      ],
    })
  })
})

describe("creating a program from an image", () => {
  const imageDraft = {
    programName: "Minicut",
    unmatchedCount: 1,
    workouts: [{
      name: "Session 1",
      scheduledDay: 1,
      exercises: [
        {
          sourceName: "Barbell Bench Press", variationId: "bench", sets: 2, reps: "6-8", rir: 2, restTime: 120, weight: 65,
          notes: "",
          setIntensityTags: [{ setNumber: 1, tag: "top_set" }, { setNumber: 2, tag: "back_off" }],
          backOff: { reps: "5-10", weight: 50 },
        },
        { sourceName: "Hack Squat", variationId: null, sets: 2, reps: "5-10", rir: 2, restTime: 0, weight: null, notes: "" },
      ],
    }],
  }

  beforeEach(() => {
    save.mockImplementation(async ([input]: [{ images?: unknown[] }]) =>
      input?.images ? imageDraft : { id: "program", name: "Minicut" })
  })

  async function readImage() {
    render(<ImportProgramDialog open exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "From image" }), { button: 0, ctrlKey: false })
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept^="image/"]')!
    fireEvent.change(input, { target: { files: [new File(["x"], "week2.png", { type: "image/png" })] } })
    await screen.findByRole("img", { name: "week2.png" })
    fireEvent.click(screen.getByRole("button", { name: "Read with AI" }))
    await screen.findByText(/1 exercise is not in your library yet/)
  }

  it("sends the downsized image and shows unmatched rows by the name in the image", async () => {
    await readImage()
    expect(save.mock.calls[0][0][0]).toEqual({ images: [{ data: "aW1hZ2U=", mediaType: "image/jpeg" }], locale: "en" })
    expect(screen.getByDisplayValue("Minicut")).toBeInTheDocument()
    expect(screen.getByText("In the image: Hack Squat")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create program" })).toBeDisabled()
  })

  it("creates the program once the coach picks an exercise for the unmatched row", async () => {
    await readImage()
    fireEvent.click(screen.getByRole("button", { name: "Expand exercise: Hack Squat" }))
    fireEvent.click(await screen.findByRole("button", { name: "Swap exercise: Hack Squat" }))
    fireEvent.click(screen.getByText("Pick Squat"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Create program" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    const session = (weekIndex: number) => ({
      name: "Session 1",
      scheduledDay: 1,
      weekIndex,
      exercises: [
        {
          variationId: "bench", sets: 2, repsMin: 6, reps: 8, rir: 2, restTime: 120, weight: 65,
          setIntensityTags: [{ setNumber: 1, tag: "top_set" }, { setNumber: 2, tag: "back_off" }],
          // The back-off set keeps its own range and load, with the top set's RIR.
          setTargets: [{ setNumber: 2, repsMin: 5, reps: 10, rir: 2, weight: 50 }],
        },
        { variationId: "squat", sets: 2, repsMin: 5, reps: 10, rir: 2, restTime: 0 },
      ],
    })
    // The photo is one week: it repeats on every week of the default 4-week program.
    expect(save.mock.calls[1][0][0]).toMatchObject({
      duration: 4,
      name: "Minicut",
      workouts: [session(0), session(1), session(2), session(3)],
    })
  })

  it("repeats the reviewed week on every week of the length the coach sets", async () => {
    await readImage()
    fireEvent.change(screen.getByDisplayValue("4"), { target: { value: "5" } })
    fireEvent.click(screen.getByRole("button", { name: "Expand exercise: Hack Squat" }))
    fireEvent.click(await screen.findByRole("button", { name: "Swap exercise: Hack Squat" }))
    fireEvent.click(screen.getByText("Pick Squat"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Create program" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    const created = save.mock.calls[1][0][0] as CreateCoachProgramInput
    expect(created.duration).toBe(5)
    expect(created.workouts.map((workout) => workout.weekIndex)).toEqual([0, 1, 2, 3, 4])
    // The exercise picked once in review is in every week.
    expect(created.workouts.every((workout) => workout.exercises[1]?.variationId === "squat")).toBe(true)
  })

  it("preselects the methods read from the set scheme on the review card", async () => {
    await readImage()
    fireEvent.click(screen.getByRole("button", { name: "Expand exercise: Bench" }))
    expect(await screen.findByRole("button", { name: "Set 1: Top set" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Set 2: Back-off set/ })).toBeInTheDocument()
    expect(screen.getByLabelText("kg")).toHaveDisplayValue("65")
    expect(screen.getByLabelText("Back-off sets Rep range")).toHaveDisplayValue("5-10")
    expect(screen.getByLabelText("Back-off sets kg")).toHaveDisplayValue("50")
  })

  it("explains when the file is not an image", async () => {
    render(<ImportProgramDialog open exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "From image" }), { button: 0, ctrlKey: false })
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept^="image/"]')!
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } })
    expect(await screen.findByText("Could not read this image. Choose a JPG, PNG or WebP file.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Read with AI" })).toBeDisabled()
  })

  async function startPendingRead() {
    let resolveRead!: (value: typeof imageDraft) => void
    save.mockImplementation(() => new Promise((resolve) => { resolveRead = resolve }))
    const props = { exerciseOptions: options, trainees, onClose: vi.fn(), onImported: vi.fn() }
    const view = render(<ImportProgramDialog {...props} initialSource="image" open />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept^="image/"]')!
    fireEvent.change(input, { target: { files: [new File(["x"], "pending.png", { type: "image/png" })] } })
    await screen.findByRole("img", { name: "pending.png" })
    fireEvent.click(screen.getByRole("button", { name: "Read with AI" }))
    return { ...view, props, resolveRead }
  }

  it("ignores a late AI result after closing, without writing a stale draft", async () => {
    const view = await startPendingRead()
    fireEvent.click(screen.getByRole("button", { name: /^Close$/ }))
    view.rerender(<ImportProgramDialog {...view.props} initialSource="image" open={false} />)
    await act(async () => view.resolveRead(imageDraft))
    expect(window.localStorage.getItem("yeahbuddy:program-import-draft:coach")).toBeNull()
    view.rerender(<ImportProgramDialog {...view.props} initialSource="image" open />)
    expect(screen.queryByDisplayValue("Minicut")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Read with AI" })).toBeDisabled()
  })

  it("does not overwrite another import source when the image result arrives late", async () => {
    const view = await startPendingRead()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Google Sheets" }), { button: 0, ctrlKey: false })
    save.mockResolvedValue({ id: "program", name: "Imported program" })
    fireEvent.click(await screen.findByText("Load sheet fixture"))
    await screen.findByDisplayValue("Imported program")
    await act(async () => view.resolveRead(imageDraft))
    expect(screen.getByDisplayValue("Imported program")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Minicut")).not.toBeInTheDocument()
  })

  it("blocks saving until the library loads and every image row is matched", async () => {
    const props = { trainees, onClose: vi.fn(), onImported: vi.fn() }
    const view = render(<ImportProgramDialog {...props} initialSource="image" open exerciseOptions={[]} />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept^="image/"]')!
    fireEvent.change(input, { target: { files: [new File(["x"], "image.png", { type: "image/png" })] } })
    await screen.findByRole("img", { name: "image.png" })
    fireEvent.click(screen.getByRole("button", { name: "Read with AI" }))
    await screen.findByDisplayValue("Minicut")
    expect(screen.getByText(/The exercise library is not available yet/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create program" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    expect(save).toHaveBeenCalledTimes(1)
    view.rerender(<ImportProgramDialog {...props} initialSource="image" open exerciseOptions={options} />)
    expect(screen.getByText(/1 exercise is not in your library yet/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create program" })).toBeDisabled()
    expect(screen.getByText("In the image: Hack Squat")).toBeInTheDocument()
  })
})

describe("an unfinished import", () => {
  const DRAFT_KEY = "yeahbuddy:program-import-draft:coach"

  it("survives closing the dialog and comes back on Review until the coach discards it", async () => {
    await openReview()
    fireEvent.change(screen.getByDisplayValue("Imported program"), { target: { value: "Push week" } })
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toContain("Push week"))
    cleanup()

    render(<ImportProgramDialog open exerciseOptions={options} trainees={trainees} onClose={vi.fn()} onImported={vi.fn()} />)
    expect(await screen.findByText(/Picked up where you left off/)).toBeInTheDocument()
    expect(screen.getByDisplayValue("Push week")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expand exercise: Bench" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }))
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(screen.getByRole("tab", { name: "From Excel" })).toBeInTheDocument()
  })

  it("is forgotten once the program is created", async () => {
    await openReview()
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull())
  })

  it("does not close on a click outside the dialog during Review", async () => {
    const onClose = vi.fn()
    render(<ImportProgramDialog open exerciseOptions={options} trainees={trainees} onClose={onClose} onImported={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Google Sheets" }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByText("Load sheet fixture"))
    await screen.findByRole("button", { name: "Expand exercise: Bench" })

    fireEvent.pointerDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Create program" })).toBeInTheDocument()
  })
})
