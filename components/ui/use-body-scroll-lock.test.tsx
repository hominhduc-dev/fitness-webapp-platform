import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"

import { useBodyScrollLock } from "./use-body-scroll-lock"

function Overlay({ active = true }: { active?: boolean }) {
  useBodyScrollLock(active)
  return null
}

afterEach(() => {
  cleanup()
  document.body.style.overflow = ""
})

describe("useBodyScrollLock", () => {
  it("freezes the page while an overlay is up and restores it afterwards", () => {
    document.body.style.overflow = "auto"
    const view = render(<Overlay />)

    expect(document.body.style.overflow).toBe("hidden")

    view.unmount()

    expect(document.body.style.overflow).toBe("auto")
  })

  it("keeps the page frozen until the last overlay closes", () => {
    const outer = render(<Overlay />)
    const inner = render(<Overlay />)

    // An editor that opens a sheet inside itself: closing the sheet must not
    // hand scrolling back while the editor is still covering the page.
    inner.unmount()
    expect(document.body.style.overflow).toBe("hidden")

    outer.unmount()
    expect(document.body.style.overflow).toBe("")
  })

  it("does nothing while it is not active", () => {
    render(<Overlay active={false} />)

    expect(document.body.style.overflow).toBe("")
  })
})
