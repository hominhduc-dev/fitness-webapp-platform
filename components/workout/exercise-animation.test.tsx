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

  it("autoplays the GIF and shows attribution when motion is allowed", () => {
    mockReducedMotion(false)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", media.animationUrl)
    expect(screen.getByRole("link", { name: "© Gym visual" })).toBeVisible()
  })

  it("keeps the thumbnail for reduced motion until explicit playback", () => {
    mockReducedMotion(true)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", media.thumbnailUrl)
    fireEvent.click(screen.getByRole("button", { name: "Play animation" }))
    expect(screen.getByRole("img")).toHaveAttribute("src", media.animationUrl)
  })

  it("hides broken media while preserving an accessible unavailable status", () => {
    mockReducedMotion(false)
    render(<ExerciseAnimation exerciseName="Row" media={media} />)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Media unavailable")
  })
})
