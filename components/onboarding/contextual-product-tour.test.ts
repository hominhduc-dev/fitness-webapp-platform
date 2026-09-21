import { describe, expect, it } from "vitest"

import { buildTours } from "./contextual-product-tour"
import { messages } from "@/lib/i18n/messages"

const { contextualTours } = buildTours(messages.en.onboarding.productTour)

/** What the component itself does: first match wins. */
const select = (pathname: string) => contextualTours.find((tour) => tour.match(pathname))?.key ?? null

describe("contextual tour routing", () => {
  /**
   * The trap this guards. "trainee-workout" matches the whole /workout/ prefix,
   * so it also covers the live session screen, where none of its targets exist.
   * Registered after it, the session tour could never be selected at all.
   */
  it("gives the live session screen its own tour, not the workout list's", () => {
    expect(select("/workout/abc123/start")).toBe("trainee-workout-session")
    expect(select("/workout/abc123/start/")).toBe("trainee-workout-session")
  })

  it("leaves the rest of /workout to the list tour", () => {
    expect(select("/workout")).toBe("trainee-workout")
    expect(select("/workout/ai-generate")).toBe("trainee-workout")
    expect(select("/workout/programs/xyz")).toBe("trainee-workout")
    // A workout id on its own is not the logging screen.
    expect(select("/workout/abc123")).toBe("trainee-workout")
  })

  it("keeps the session tour scoped to trainees", () => {
    const session = contextualTours.find((tour) => tour.key === "trainee-workout-session")
    expect(session?.roles).toEqual(["trainee"])
  })

  it("points every session step at an anchor that the screen renders", () => {
    const session = contextualTours.find((tour) => tour.key === "trainee-workout-session")

    expect(session?.steps.map((step) => step.target)).toEqual([
      "[data-tour='session-stats']",
      "[data-tour='session-exercise']",
      "[data-tour='session-set']",
      "[data-tour='session-finish']",
    ])
  })

  it("carries real copy rather than a missing key", () => {
    const session = contextualTours.find((tour) => tour.key === "trainee-workout-session")

    for (const step of session?.steps ?? []) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.body.length).toBeGreaterThan(0)
    }
  })

  it("does not fire on other roles' routes", () => {
    expect(select("/coach/programs")).toBe("coach-programs")
    expect(select("/dashboard")).toBe("trainee-dashboard")
    expect(select("/admin")).toBeNull()
  })
})
