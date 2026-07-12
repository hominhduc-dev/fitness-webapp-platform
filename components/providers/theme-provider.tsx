"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme: (nextTheme: ThemeMode) => void
  theme: ThemeMode
}

export const themeStorageKey = "yeahbuddy-theme"
const darkQuery = "(prefers-color-scheme: dark)"
const lightThemeColor = "#f8fafc"
const darkThemeColor = "#0b0d12"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function getStoredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey)
    return isThemeMode(storedTheme) ? storedTheme : "system"
  } catch {
    return "system"
  }
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme !== "system") {
    return theme
  }

  return window.matchMedia?.(darkQuery).matches ? "dark" : "light"
}

function applyThemeToDocument(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeColor?.setAttribute("content", resolvedTheme === "dark" ? darkThemeColor : lightThemeColor)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light")
  const themeRef = useRef<ThemeMode>("system")

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    const nextResolvedTheme = resolveTheme(nextTheme)
    applyThemeToDocument(nextResolvedTheme)
    setResolvedTheme(nextResolvedTheme)
  }, [])

  useEffect(() => {
    const storedTheme = getStoredTheme()
    themeRef.current = storedTheme
    setThemeState(storedTheme)
    applyTheme(storedTheme)

    const mediaQuery = window.matchMedia?.(darkQuery)
    if (!mediaQuery) {
      return
    }

    const handleSystemThemeChange = () => {
      if (themeRef.current === "system") {
        applyTheme("system")
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange)
  }, [applyTheme])

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      themeRef.current = nextTheme
      setThemeState(nextTheme)

      try {
        window.localStorage.setItem(themeStorageKey, nextTheme)
      } catch {
        // Persisting theme is best-effort; the selected theme still applies for this session.
      }

      applyTheme(nextTheme)
    },
    [applyTheme],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme,
      theme,
    }),
    [resolvedTheme, setTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
