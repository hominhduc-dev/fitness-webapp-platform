import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExerciseLibraryPanel } from "./admin-exercises-panel"
import type { AdminExerciseItem } from "@/lib/admin/types"

vi.mock("@/components/exercises/exercise-thumbnail", () => ({
  ExerciseThumbnail: ({ name, previewable }: { name: string; previewable?: boolean }) =>
    previewable ? <button type="button">Preview {name}</button> : <span>{name}</span>,
}))

const exercise: AdminExerciseItem = {
  id: "bench", name: "Bench Press", variationName: "Default", muscleGroup: "Chest",
  primaryMuscles: ["chest"], secondaryMuscles: [], activityType: "strength",
  equipment: "Barbell", usageCount: 0, isDefault: true, createdBy: null,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
}

function renderLibrary(readOnly: boolean) {
  const onSave = vi.fn(async () => undefined)
  render(<ExerciseLibraryPanel
    readOnly={readOnly} exercises={[exercise]} locale="en" actionKey={null}
    onSave={onSave} onDelete={vi.fn(async () => undefined)}
    onBulkDelete={vi.fn(async () => undefined)} onImport={vi.fn()} onDownloadTemplate={vi.fn()}
  />)
  return { onSave }
}

afterEach(cleanup)

describe("read-only exercise library", () => {
  it("keeps browsing and preview while removing management controls even for manageable items", () => {
    const { onSave } = renderLibrary(true)
    expect(screen.queryByRole("button", { name: "New exercise" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Import Excel" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Chest\s*1 exercise/ }))
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Preview Bench Press" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Bench Press$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Actions: Bench Press" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Select$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("does not expose a review-status filter to public catalogues", () => {
    renderLibrary(true)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    expect(screen.getByRole("combobox", { name: "Equipment" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Muscle review" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Most used" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("name")
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }))
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("name")
  })

  it("preserves coach management and review filters by default", () => {
    renderLibrary(false)
    expect(screen.getByRole("button", { name: "New exercise" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Import Excel" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    expect(screen.getByRole("combobox", { name: "Muscle review" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("popular")
  })
})
