import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MuscleMap } from "./muscle-map"

describe("MuscleMap interactions", () => {
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

  it("does not make decorative regions interactive", () => {
    const onClick = vi.fn()
    const { container } = render(<MuscleMap side="front" onMuscleClick={onClick} />)
    const head = container.querySelector('[data-muscle="head"]')!
    fireEvent.click(head)
    expect(onClick).not.toHaveBeenCalled()
    expect(head).not.toHaveClass("cursor-pointer")
  })
})
