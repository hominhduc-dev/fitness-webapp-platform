import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { MuscleProfileSummary, canApproveMuscleProfile } from "./muscle-profile-summary"

afterEach(cleanup)

describe("MuscleProfileSummary", () => {
  it("shows the AI confidence, targets and the rationale as a tooltip", () => {
    render(
      <MuscleProfileSummary
        locale="en"
        exercise={{
          muscleProfileConfidence: 0.92,
          muscleProfileRationale: "Rows pull the shoulder blades together.",
          muscleProfileSource: "ai",
          primaryMuscles: ["upper-back", "trapezius"],
          secondaryMuscles: ["biceps"],
        }}
      />,
    )

    const summary = screen.getByText(/Primary: upper back, trapezius/).closest("p")
    expect(summary).toHaveTextContent("AI 92% · Primary: upper back, trapezius · Secondary: biceps")
    expect(summary).toHaveAttribute("title", "Rows pull the shoulder blades together.")
  })

  it("renders nothing when the variation has no targets yet", () => {
    const { container } = render(<MuscleProfileSummary locale="vi" exercise={{ primaryMuscles: [], secondaryMuscles: [] }} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe("canApproveMuscleProfile", () => {
  it("requires a primary muscle for strength but not for other activities", () => {
    expect(canApproveMuscleProfile({ activityType: "strength", primaryMuscles: [] })).toBe(false)
    expect(canApproveMuscleProfile({ activityType: "strength", primaryMuscles: ["chest"] })).toBe(true)
    expect(canApproveMuscleProfile({ activityType: "mobility", primaryMuscles: [] })).toBe(true)
    expect(canApproveMuscleProfile({ primaryMuscles: ["chest"] })).toBe(false)
  })
})
