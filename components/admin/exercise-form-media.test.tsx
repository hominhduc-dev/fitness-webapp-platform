import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExerciseFormModal } from "./admin-exercises-panel"
import type { AdminExerciseItem } from "@/lib/admin/types"

vi.mock("@/components/exercises/exercise-thumbnail", () => ({
  ExerciseThumbnail: () => <span data-testid="exercise-thumbnail" />,
}))

const exercise = {
  activityType: "strength",
  createdAt: new Date("2026-10-01"),
  createdBy: null,
  equipment: "Cable",
  id: "4c321b33-092a-4f49-9814-596676047ec4",
  isDefault: true,
  muscleGroup: "Back",
  name: "Cable One Arm High Row",
  primaryMuscles: ["upper-back"],
  secondaryMuscles: [],
  updatedAt: new Date("2026-10-01"),
  usageCount: 0,
  variationName: "Default",
} as unknown as AdminExerciseItem

const thumbnail = new File(["thumb"], "row.png", { type: "image/png" })
const animation = new File(["anim"], "row.mp4", { type: "video/mp4" })

function renderEdit() {
  const calls: string[] = []
  const media = {
    onRemove: vi.fn(async () => undefined),
    onSave: vi.fn(async () => {
      calls.push("media")
    }),
  }
  const onSave = vi.fn(() => {
    calls.push("form")
  })
  render(<ExerciseFormModal initial={exercise} locale="vi" media={media} saving={false} onClose={() => undefined} onSave={onSave} />)
  return { calls, media, onSave }
}

function pick(label: string, file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ExerciseFormModal media on Save", () => {
  it("uploads media picked in the dialog before saving the form", async () => {
    const { calls, media, onSave } = renderEdit()
    pick("Thumbnail", thumbnail)
    pick("Animation", animation)

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(media.onSave).toHaveBeenCalledWith({ animation, thumbnail })
    expect(calls).toEqual(["media", "form"])
  })

  it("explains instead of dropping a lone file when the exercise has no media", async () => {
    const { media, onSave } = renderEdit()
    pick("Thumbnail", thumbnail)

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Chưa lưu: bài tập chưa có media nên cần chọn cả thumbnail và animation.")).toBeTruthy()
    expect(media.onSave).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("keeps the form open when the upload fails", async () => {
    const { media, onSave } = renderEdit()
    media.onSave.mockRejectedValueOnce(new Error("Cloudinary từ chối file."))
    pick("Thumbnail", thumbnail)
    pick("Animation", animation)

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Cloudinary từ chối file.")).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("saves the form alone when no media was picked", async () => {
    const { media, onSave } = renderEdit()
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(media.onSave).not.toHaveBeenCalled()
  })
})
