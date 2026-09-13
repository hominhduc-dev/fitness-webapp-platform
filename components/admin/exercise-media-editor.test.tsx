import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExerciseMediaEditor } from "./exercise-media-editor"
import type { AdminExerciseItem } from "@/lib/admin/types"

vi.mock("@/components/exercises/exercise-thumbnail", () => ({
  ExerciseThumbnail: () => <span data-testid="exercise-thumbnail" />,
}))

const exercise = {
  createdAt: new Date("2026-09-01"),
  createdBy: null,
  id: "3f1c9a4e-2b7d-4c8e-9f10-1a2b3c4d5e6f",
  isDefault: true,
  muscleGroup: "Chest",
  name: "Bench Press",
  updatedAt: new Date("2026-09-01"),
  usageCount: 0,
  variationName: "Default",
} as AdminExerciseItem

const syncedMedia = {
  animationUrl: "https://project.supabase.co/a.gif",
  height: 180 as const,
  thumbnailUrl: "https://project.supabase.co/t.jpg",
  type: "gif" as const,
  width: 180 as const,
}

function pick(label: string, file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } })
}

const thumbnailFile = new File(["thumb"], "bench.png", { type: "image/png" })
const animationFile = new File(["anim"], "bench.mp4", { type: "video/mp4" })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ExerciseMediaEditor", () => {
  it("needs both files before uploading media for an exercise without any", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ExerciseMediaEditor exercise={exercise} locale="en" onRemove={vi.fn()} onSave={onSave} />)
    const upload = screen.getByRole("button", { name: "Upload media" })

    pick("Thumbnail", thumbnailFile)
    expect(upload).toBeDisabled()

    pick("Animation", animationFile)
    expect(upload).toBeEnabled()
    fireEvent.click(upload)

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Media updated."))
    expect(onSave).toHaveBeenCalledWith({ animation: animationFile, thumbnail: thumbnailFile })
  })

  it("replaces a single side when the exercise already has media", () => {
    render(<ExerciseMediaEditor exercise={{ ...exercise, media: syncedMedia, mediaSource: "external" }} locale="en" onRemove={vi.fn()} onSave={vi.fn()} />)

    pick("Thumbnail", thumbnailFile)

    expect(screen.getByRole("button", { name: "Upload media" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Remove uploaded media" })).not.toBeInTheDocument()
  })

  it("rejects a file of the wrong type before any upload", () => {
    const onSave = vi.fn()
    render(<ExerciseMediaEditor exercise={exercise} locale="en" onRemove={vi.fn()} onSave={onSave} />)

    pick("Thumbnail", new File(["x"], "clip.mp4", { type: "video/mp4" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Thumbnail must be JPG, PNG, WebP.")
    expect(screen.getByRole("button", { name: "Upload media" })).toBeDisabled()
  })

  it("shows the upload error from the server", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Storage is down"))
    render(<ExerciseMediaEditor exercise={{ ...exercise, media: syncedMedia, mediaSource: "dataset" }} locale="en" onRemove={vi.fn()} onSave={onSave} />)

    pick("Animation", animationFile)
    fireEvent.click(screen.getByRole("button", { name: "Upload media" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Storage is down"))
  })

  it("removes uploaded media after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<ExerciseMediaEditor exercise={{ ...exercise, media: syncedMedia, mediaSource: "custom" }} locale="vi" onRemove={onRemove} onSave={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Xoá media đã tải lên" }))

    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole("status")).toHaveTextContent("Đã xoá media đã tải lên.")
  })
})
