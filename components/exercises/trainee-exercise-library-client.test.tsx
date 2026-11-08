import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TraineeExerciseLibraryClient } from "./trainee-exercise-library-client"

const state = vi.hoisted(() => ({ query: vi.fn(), panel: vi.fn() }))
vi.mock("@/lib/queries/exercises", () => ({ useExercises: state.query }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ locale: "en" }) }))
vi.mock("@/components/admin/admin-exercises-panel", () => ({
  ExerciseLibraryPanel: (props: unknown) => { state.panel(props); return <div>Catalogue</div> },
}))

describe("TraineeExerciseLibraryClient", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it("keeps each variation distinct and strips management permissions", () => {
    const base = {
      exerciseId: "bench", exerciseName: "Bench Press", name: "Bench Press",
      muscleGroup: "Chest", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"],
      sortOrder: 0, canManage: true,
    }
    state.query.mockReturnValue({ data: [
      { ...base, id: "barbell", variationName: "Barbell", isDefault: true, equipment: "Barbell" },
      { ...base, id: "dumbbell", variationName: "Dumbbell", isDefault: false, equipment: "Dumbbell" },
    ], isPending: false, isError: false })
    render(<TraineeExerciseLibraryClient />)
    const props = state.panel.mock.calls[0][0]
    expect(props.readOnly).toBe(true)
    expect(props.exercises).toEqual([
      expect.objectContaining({ id: "barbell", variationName: "Barbell", canManage: false }),
      expect.objectContaining({ id: "dumbbell", variationName: "Dumbbell", canManage: false }),
    ])
    expect(props.onAiDraft).toBeUndefined()
    expect(props.onRequestShare).toBeUndefined()
  })

  it("offers retry when the catalogue fails instead of an empty library", () => {
    const refetch = vi.fn()
    state.query.mockReturnValue({ isPending: false, isError: true, refetch })
    render(<TraineeExerciseLibraryClient />)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(state.panel).not.toHaveBeenCalled()
  })

  it("announces loading before catalogue data is available", () => {
    state.query.mockReturnValue({ isPending: true, isError: false })
    render(<TraineeExerciseLibraryClient />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading exercise library")
    expect(state.panel).not.toHaveBeenCalled()
  })
})
