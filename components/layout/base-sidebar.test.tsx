import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Home } from "lucide-react"
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { BaseSidebar } from "./base-sidebar"

afterEach(cleanup)

function SidebarHarness({ activeStyle }: { activeStyle: "primary" | "muted" }) {
  const [collapsed, setCollapsed] = useState(true)
  return <BaseSidebar collapsible collapsed={collapsed}
    onToggleCollapse={() => setCollapsed(!collapsed)}
    activeStyle={activeStyle} brand={<span>Brand</span>} compactBrand={<span>Mark</span>} footer={<span>Account</span>}
    sections={[{ items: [{ href: "/dashboard", label: "Home", icon: Home }] }]} isActiveItem={() => true} />
}

describe.each(["primary", "muted"] as const)("shared sidebar %s", (activeStyle) => {
  it("stays collapsed on hover and expands only when the brand button is clicked", () => {
    const { container } = render(<SidebarHarness activeStyle={activeStyle} />)
    const rail = container.querySelector("aside")!
    expect(rail.className).toContain("w-[72px]")
    const pointer = new MouseEvent("pointerover", { bubbles: true })
    Object.defineProperty(pointer, "pointerType", { value: "mouse" })
    fireEvent(rail, pointer)
    expect(rail.firstElementChild?.className).not.toContain("absolute")
    expect(rail.className).toContain("w-[72px]")
    fireEvent.pointerOut(rail)
    expect(rail.firstElementChild?.className).not.toContain("absolute")
    fireEvent(rail, pointer)
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(rail.className).toContain("w-[232px]")
    expect(rail.firstElementChild?.className).not.toContain("absolute")
    expect(screen.getByRole("button", { name: "Collapse sidebar" }).getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(rail.className).toContain("w-[72px]")
  })
})
