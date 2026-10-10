import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider, themeStorageKey, useTheme } from "./theme-provider"

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme()
  return <output>{theme}:{resolvedTheme}</output>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ""
  document.head.innerHTML = '<meta name="theme-color" content="">'
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.className = ""
  localStorage.clear()
})

describe("ThemeProvider brand default", () => {
  it("starts new visitors in Black + Volt without saving a forced preference", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent("black-volt:black-volt")
    expect(document.documentElement).toHaveClass("dark", "black-volt")
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#0d0f0e")
    expect(document.documentElement.style.colorScheme).toBe("dark")
    expect(localStorage.getItem(themeStorageKey)).toBeNull()
  })

  it.each(["light", "electric-blue", "dark", "system"])("preserves the existing %s preference", (stored) => {
    localStorage.setItem(themeStorageKey, stored)
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent(`${stored}:${stored === "system" ? "light" : stored}`)
    expect(localStorage.getItem(themeStorageKey)).toBe(stored)
    expect(document.documentElement).not.toHaveClass("black-volt")
  })

  it.each([["glass", "dark"], ["midnight", "dark"], ["sport", "electric-blue"]])("migrates %s to %s instead of overriding with the brand default", (stored, migrated) => {
    localStorage.setItem(themeStorageKey, stored)
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent(`${migrated}:${migrated}`)
    expect(localStorage.getItem(themeStorageKey)).toBe(migrated)
  })
})
