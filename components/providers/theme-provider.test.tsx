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

describe("ThemeProvider default", () => {
  it("starts new visitors in light without saving a forced preference", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent("light:light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#e8ecf3")
    expect(document.documentElement.style.colorScheme).toBe("light")
    expect(localStorage.getItem(themeStorageKey)).toBeNull()
  })

  it.each(["black-volt", "electric-blue", "dark", "system"])("preserves the existing %s preference", (stored) => {
    localStorage.setItem(themeStorageKey, stored)
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent(`${stored}:${stored === "system" ? "light" : stored}`)
    expect(localStorage.getItem(themeStorageKey)).toBe(stored)
  })

  it("forces light on signed-out pages without touching the stored theme", () => {
    localStorage.setItem(themeStorageKey, "black-volt")
    render(<ThemeProvider initialTheme="light"><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent("light:light")
    expect(document.documentElement).not.toHaveClass("dark", "black-volt")
    expect(localStorage.getItem(themeStorageKey)).toBe("black-volt")
  })

  it.each([["glass", "dark"], ["midnight", "dark"], ["sport", "electric-blue"]])("migrates %s to %s instead of overriding with the brand default", (stored, migrated) => {
    localStorage.setItem(themeStorageKey, stored)
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByRole("status")).toHaveTextContent(`${migrated}:${migrated}`)
    expect(localStorage.getItem(themeStorageKey)).toBe(migrated)
  })
})
