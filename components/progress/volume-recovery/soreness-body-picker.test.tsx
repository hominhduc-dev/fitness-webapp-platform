import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TRAINABLE_MUSCLE_SLUGS } from "@/components/body/muscle-map"
import { volumeRecoveryMessages } from "@/lib/i18n/messages/volume-recovery"

import {
  SorenessBodyPicker,
  buildSorenessPayload,
  sorestMuscle,
  type SorenessByMuscle,
} from "./soreness-body-picker"

vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ messages: volumeRecoveryMessages.en }),
}))

function Harness({ initial = {} }: { initial?: SorenessByMuscle }) {
  const [value, setValue] = useState<SorenessByMuscle>(initial)
  return (
    <>
      <SorenessBodyPicker value={value} onChange={setValue} trainedSlugs={["chest"]} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

const currentValue = () => JSON.parse(screen.getByTestId("value").textContent ?? "{}")

describe("SorenessBodyPicker", () => {
  afterEach(cleanup)

  it("marks a tapped muscle sore at moderate, and clears it on a second tap", () => {
    render(<Harness />)
    expect(screen.getByText("No sore muscles.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Quads" }))
    expect(currentValue()).toEqual({ quadriceps: 3 })
    expect(screen.getByRole("button", { name: "Quads, sore: Moderate" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Quads, sore: Moderate" }))
    expect(currentValue()).toEqual({})
  })

  it("sets each marked muscle's level from the list", () => {
    render(<Harness initial={{ quadriceps: 3 }} />)
    fireEvent.click(screen.getByRole("radio", { name: "High" }))
    expect(currentValue()).toEqual({ quadriceps: 4 })
  })

  it("removes a muscle from the list", () => {
    render(<Harness initial={{ quadriceps: 3, chest: 2 }} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove Quads" }))
    expect(currentValue()).toEqual({ chest: 2 })
  })

  it("turns the figure round to reach back muscles", () => {
    render(<Harness />)
    expect(screen.queryByRole("button", { name: "Hamstrings" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Back" }))
    fireEvent.click(screen.getByRole("button", { name: "Hamstrings" }))
    expect(currentValue()).toEqual({ hamstring: 3 })
  })
})

describe("soreness payload", () => {
  it("rates every muscle when answered: tapped ones at their level, the rest at 0", () => {
    const payload = buildSorenessPayload({ quadriceps: 4 }, true)
    expect(payload).toHaveLength(TRAINABLE_MUSCLE_SLUGS.length)
    expect(payload.find((muscle) => muscle.muscleSlug === "quadriceps")?.soreness).toBe(4)
    expect(payload.filter((muscle) => muscle.soreness === 0)).toHaveLength(TRAINABLE_MUSCLE_SLUGS.length - 1)
  })

  it("still answers when nothing is sore, and sends nothing when skipped", () => {
    expect(buildSorenessPayload({}, true).every((muscle) => muscle.soreness === 0)).toBe(true)
    expect(buildSorenessPayload({ quadriceps: 4 }, false)).toEqual([])
  })

  it("finds the sorest muscle, or none when nothing is sore", () => {
    expect(sorestMuscle([{ muscleSlug: "chest", soreness: 2 }, { muscleSlug: "quadriceps", soreness: 4 }])?.muscleSlug)
      .toBe("quadriceps")
    expect(sorestMuscle([{ muscleSlug: "chest", soreness: 0 }])).toBeNull()
  })
})
