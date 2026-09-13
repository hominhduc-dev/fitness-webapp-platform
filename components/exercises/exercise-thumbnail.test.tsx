import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExerciseThumbnail } from "./exercise-thumbnail"
import type { ExerciseMedia } from "@/lib/types"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    locale: "en",
    messages: {
      workoutPage: {
        exerciseAnimationAlt: (name: string) => `Animation for ${name}`,
        exerciseMediaUnavailable: "Media unavailable",
        playExerciseAnimation: "Play animation",
      },
    },
  }),
}))

const media: ExerciseMedia = {
  animationUrl: "https://project.supabase.co/animation.gif",
  height: 180,
  thumbnailUrl: "https://project.supabase.co/thumbnail.jpg",
  type: "gif",
  width: 180,
}

beforeEach(() => {
  // jsdom has no matchMedia; the preview's ExerciseAnimation reads reduced motion from it.
  window.matchMedia = vi.fn().mockReturnValue({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
})

afterEach(cleanup)

describe("ExerciseThumbnail", () => {
  it("shows the thumbnail image, never the animation, in a list", () => {
    const { container } = render(<ExerciseThumbnail media={media} name="Row" />)

    const image = container.querySelector("img")
    expect(image).toHaveAttribute("src", media.thumbnailUrl)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("falls back to an icon when the exercise has no media", () => {
    const { container } = render(<ExerciseThumbnail name="Row" />)

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("falls back to an icon when the thumbnail fails to load", () => {
    const { container } = render(<ExerciseThumbnail media={media} name="Row" />)

    fireEvent.error(container.querySelector("img")!)

    expect(container.querySelector("img")).toBeNull()
  })

  it("opens the animation preview when previewable", () => {
    render(<ExerciseThumbnail media={media} name="Row" previewable />)

    fireEvent.click(screen.getByRole("button", { name: "Play animation: Row" }))

    expect(screen.getByRole("dialog")).toHaveTextContent("Row")
  })

  it("is not a button when there is nothing to preview", () => {
    render(<ExerciseThumbnail name="Row" previewable />)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
