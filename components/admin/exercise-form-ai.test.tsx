import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExerciseFormModal } from "./admin-exercises-panel"
import type { ExerciseAIDraft } from "@/lib/fitness/api"

const draft: ExerciseAIDraft = {
  activityType: "strength",
  confidence: "high",
  equipment: "Dumbbell",
  existingExercise: null,
  found: true,
  movementPattern: "horizontal_push",
  muscleGroup: "Chest",
  name: "Incline Dumbbell Bench Press",
  note: "Ghế nghiêng 30–45°.",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["deltoids", "triceps"],
  variationName: "",
}

function renderForm(props: { initialName?: string; onUseExisting?: (id: string) => void } = {}) {
  const onAiDraft = vi.fn(async () => draft)
  // StrictMode, as in dev: effects run, clean up and run again.
  render(
    <StrictMode>
      <ExerciseFormModal
        allowMedia={false}
        initial={null}
        initialName={props.initialName}
        duplicateCandidates={[{ id: "library-bench", name: "Barbell Bench Press" }]}
        onUseExisting={props.onUseExisting}
        locale="vi"
        onAiDraft={onAiDraft}
        saving={false}
        onClose={() => undefined}
        onSave={() => undefined}
      />
    </StrictMode>,
  )
  return { onAiDraft, nameInput: screen.getByLabelText("Tên bài tập") as HTMLInputElement }
}

function typeName(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ExerciseFormModal AI lookup", () => {
  it("looks the typed name up on leaving the field and keeps the coach's wording", async () => {
    const { onAiDraft, nameInput } = renderForm()
    typeName(nameInput, "đẩy ngực dốc tạ đơn")

    await waitFor(() => expect(onAiDraft).toHaveBeenCalledWith({ locale: "vi", query: "đẩy ngực dốc tạ đơn" }))
    expect(await screen.findByText('Dùng tên chuẩn "Incline Dumbbell Bench Press"')).toBeTruthy()
    expect(nameInput.value).toBe("đẩy ngực dốc tạ đơn")
    expect(screen.getAllByText("Đẩy ngang").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Dùng tên chuẩn "Incline Dumbbell Bench Press"'))
    expect(nameInput.value).toBe("Incline Dumbbell Bench Press")
  })

  it("does not look the same name up twice", async () => {
    const { onAiDraft, nameInput } = renderForm()
    typeName(nameInput, "Bulgarian split squat")
    await waitFor(() => expect(onAiDraft).toHaveBeenCalledTimes(1))

    fireEvent.focus(nameInput)
    fireEvent.blur(nameInput)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onAiDraft).toHaveBeenCalledTimes(1)
  })

  it("leaves hand-edited fields alone until the AI button is pressed", async () => {
    const { onAiDraft, nameInput } = renderForm()
    fireEvent.change(screen.getByPlaceholderText("VD: Wide Grip"), { target: { value: "Paused" } })
    typeName(nameInput, "Bench press")
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onAiDraft).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Điền bằng AI" }))
    await waitFor(() => expect(onAiDraft).toHaveBeenCalledTimes(1))
  })

  it("warns about a library duplicate while typing, before any AI call", () => {
    const onUseExisting = vi.fn()
    const { onAiDraft, nameInput } = renderForm({ onUseExisting })
    fireEvent.change(nameInput, { target: { value: "BB bench presses" } })

    expect(screen.getByText('Thư viện đã có "Barbell Bench Press"')).toBeTruthy()
    expect(onAiDraft).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Dùng bài này" }))
    expect(onUseExisting).toHaveBeenCalledWith("library-bench")
  })

  it("looks a name handed in by the picker up as soon as the form opens", async () => {
    const { onAiDraft } = renderForm({ initialName: "face pull" })
    await waitFor(() => expect(onAiDraft).toHaveBeenCalledWith({ locale: "vi", query: "face pull" }))
  })
})
