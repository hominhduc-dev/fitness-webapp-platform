import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { muscleGroupToSlugs } from "@/lib/fitness/muscle-map"

import { MuscleMap, preferredBodySide } from "./muscle-map"

describe("MuscleMap interactions", () => {
  afterEach(cleanup)

  it("paints primary and secondary regions with their supplied colors", () => {
    const { container } = render(<MuscleMap side="front" highlights={{ chest: "primary", tibialis: "secondary" }} />)
    expect(container.querySelector('[data-muscle="chest"]')).toHaveAttribute("fill", "primary")
    expect(container.querySelector('[data-muscle="tibialis"]')).toHaveAttribute("fill", "secondary")
  })

  it("clicks only the exact trainable slug", () => {
    const onClick = vi.fn()
    const { container } = render(<MuscleMap side="front" onMuscleClick={onClick} />)
    fireEvent.click(container.querySelector('[data-muscle="tibialis"]')!)
    expect(onClick).toHaveBeenCalledWith("tibialis")
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("makes each muscle one keyboard-reachable button with its own name and state", () => {
    const onClick = vi.fn()
    const { getByRole, queryByRole } = render(
      <MuscleMap
        side="front"
        onMuscleClick={onClick}
        selectedSlugs={new Set(["chest"])}
        getMuscleLabel={(slug) => `Muscle ${slug}`}
      />,
    )
    const chest = getByRole("button", { name: "Muscle chest" })
    expect(chest).toHaveAttribute("aria-pressed", "true")
    expect(chest).toHaveAttribute("tabindex", "0")
    expect(getByRole("button", { name: "Muscle biceps" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.keyDown(chest, { key: "Enter" })
    fireEvent.keyDown(getByRole("button", { name: "Muscle biceps" }), { key: " " })
    expect(onClick).toHaveBeenNthCalledWith(1, "chest")
    expect(onClick).toHaveBeenNthCalledWith(2, "biceps")
    expect(queryByRole("button", { name: "Muscle head" })).not.toBeInTheDocument()
  })

  it("stays a plain picture without a click handler", () => {
    const { getByRole, queryAllByRole } = render(<MuscleMap side="front" label="Map" />)
    expect(getByRole("img", { name: "Map" })).toBeInTheDocument()
    expect(queryAllByRole("button")).toHaveLength(0)
  })

  it("does not make decorative regions interactive", () => {
    const onClick = vi.fn()
    const { container } = render(<MuscleMap side="front" onMuscleClick={onClick} />)
    const head = container.querySelector('[data-muscle="head"]')!
    fireEvent.click(head)
    expect(onClick).not.toHaveBeenCalled()
    expect(head).not.toHaveClass("cursor-pointer")
  })
})

describe("preferredBodySide", () => {
  const sideFor = (group: string) => preferredBodySide(muscleGroupToSlugs(group))

  it("turns the figure round for muscles drawn mostly on the back", () => {
    expect(sideFor("Back")).toBe("back")
    expect(sideFor("Legs")).toBe("back")
    expect(sideFor("Glutes")).toBe("back")
  })

  it("keeps the front for arms, chest and core", () => {
    expect(sideFor("Arms")).toBe("front")
    expect(sideFor("Chest")).toBe("front")
    expect(sideFor("Core")).toBe("front")
  })

  it("shows calves from behind, where both sides draw them", () => {
    expect(sideFor("Calves")).toBe("back")
  })

  it("defaults to the front with nothing to show", () => {
    expect(preferredBodySide([])).toBe("front")
  })
})
