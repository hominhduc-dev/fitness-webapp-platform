import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExerciseShareReviewPanel } from "./exercise-share-review-panel"
import type { AdminExerciseItem, AdminExerciseShareRequest } from "@/lib/admin/types"

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("@/components/providers/toast-provider", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/components/exercises/exercise-thumbnail", () => ({
  ExerciseThumbnail: () => <span data-testid="exercise-thumbnail" />,
}))
vi.mock("@/lib/queries/admin", () => ({
  useAdminExerciseShareRequests: () => ({ data: [request], isPending: false }),
  useReviewAdminExerciseShare: () => ({ mutateAsync: mocks.review }),
}))

const VARIATION_ID = "4c321b33-092a-4f49-9814-596676047ec4"

const request: AdminExerciseShareRequest = {
  coach: { id: "coach-1", name: "Thành Huỳnh" },
  id: "d156d64a-28e5-46f7-a185-18af9b857c00",
  muscleGroup: "Shoulders",
  name: "Cable Powell Raise",
  requestedAt: new Date("2026-10-14"),
  usageCount: 8,
  variations: [{ equipment: "Cable", id: VARIATION_ID, isDefault: true, name: "Default", primaryMuscles: ["deltoids"], secondaryMuscles: [] }],
}

const libraryRow = {
  activityType: "strength",
  createdAt: new Date("2026-10-14"),
  createdBy: null,
  equipment: "Cable",
  id: VARIATION_ID,
  isDefault: true,
  muscleGroup: "Shoulders",
  name: "Cable Powell Raise",
  primaryMuscles: ["deltoids"],
  secondaryMuscles: [],
  updatedAt: new Date("2026-10-14"),
  usageCount: 8,
  variationName: "Default",
} as unknown as AdminExerciseItem

function renderPanel() {
  const onSaveExercise = vi.fn(async () => undefined)
  render(
    <ExerciseShareReviewPanel
      libraryExercises={[libraryRow]}
      locale="vi"
      onSaveExercise={onSaveExercise}
      onSaveMedia={vi.fn(async () => undefined)}
      onRemoveMedia={vi.fn(async () => undefined)}
    />,
  )
  return { onSaveExercise }
}

beforeEach(() => {
  mocks.review.mockResolvedValue({ decision: "approved" })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ExerciseShareReviewPanel preview", () => {
  it("opens the exercise in the edit form and lists what is missing", () => {
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và sửa: Cable Powell Raise" }))

    expect(screen.getByDisplayValue("Cable Powell Raise")).toBeTruthy()
    expect(screen.getByText("Còn thiếu trước khi dùng chung:")).toBeTruthy()
    expect(screen.getByText("thumbnail và animation · kiểu chuyển động")).toBeTruthy()
  })

  it("saves the edits and then approves with Save & approve", async () => {
    const { onSaveExercise } = renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và sửa: Cable Powell Raise" }))
    fireEvent.click(screen.getByRole("button", { name: "Lưu & duyệt" }))

    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith([request.id, { decision: "approve" }]))
    expect(onSaveExercise).toHaveBeenCalledWith(expect.objectContaining({ id: VARIATION_ID, name: "Cable Powell Raise" }))
    expect(onSaveExercise.mock.invocationCallOrder[0]).toBeLessThan(mocks.review.mock.invocationCallOrder[0])
  })

  it("saves without approving when Save is pressed", async () => {
    const { onSaveExercise } = renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và sửa: Cable Powell Raise" }))
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(onSaveExercise).toHaveBeenCalled())
    expect(mocks.review).not.toHaveBeenCalled()
  })

  it("does not approve when the save fails", async () => {
    const { onSaveExercise } = renderPanel()
    onSaveExercise.mockRejectedValueOnce(new Error("Tên bài tập không hợp lệ."))
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và sửa: Cable Powell Raise" }))
    fireEvent.click(screen.getByRole("button", { name: "Lưu & duyệt" }))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "Tên bài tập không hợp lệ.", tone: "error" }))
    expect(mocks.review).not.toHaveBeenCalled()
  })
})
