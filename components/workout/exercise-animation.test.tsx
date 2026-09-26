import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExerciseAnimation } from "./exercise-animation"

vi.mock("next/image", () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ComponentProps<"img"> & { unoptimized?: boolean }) => <img {...props} />,
}))

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    messages: {
      workoutPage: {
        exerciseAnimationAlt: (name: string) => `${name} animation`,
        exerciseMediaUnavailable: "Media unavailable",
        playExerciseAnimation: "Play animation",
      },
    },
  }),
}))

const media = {
  animationUrl: "https://project.supabase.co/animation.gif",
  height: 180 as const,
  thumbnailUrl: "https://project.supabase.co/thumbnail.jpg",
  width: 180 as const,
}

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      addEventListener: vi.fn(),
      matches,
      media: "(prefers-reduced-motion: reduce)",
      removeEventListener: vi.fn(),
    })),
  })
}

describe("ExerciseAnimation", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("autoplays the GIF without an attribution link when motion is allowed", () => {
    mockReducedMotion(false)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", media.animationUrl)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("keeps the thumbnail for reduced motion until explicit playback", () => {
    mockReducedMotion(true)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", media.thumbnailUrl)
    fireEvent.click(screen.getByRole("button", { name: "Play animation" }))
    expect(screen.getByRole("img")).toHaveAttribute("src", media.animationUrl)
  })

  it("plays straight away under reduced motion when opened on purpose", () => {
    mockReducedMotion(true)
    render(<ExerciseAnimation exerciseName="Row" media={media} playOnMount />)
    expect(screen.getByRole("img")).toHaveAttribute("src", media.animationUrl)
    expect(screen.queryByRole("button", { name: "Play animation" })).not.toBeInTheDocument()
  })

  it("hides broken media while preserving an accessible unavailable status", () => {
    mockReducedMotion(false)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Media unavailable")
  })

  it("renders MP4 media as video with the thumbnail poster", () => {
    mockReducedMotion(false)
    render(<ExerciseAnimation exerciseName="Row" media={{ ...media, animationUrl: "https://project.supabase.co/animation.mp4", type: "video" }} />)
    const video = screen.getByLabelText("Row animation")
    expect(video.tagName).toBe("VIDEO")
    expect(video).toHaveAttribute("src", "https://project.supabase.co/animation.mp4")
    expect(video).toHaveAttribute("poster", media.thumbnailUrl)
  })
})
