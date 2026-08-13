"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "glass" | "system"
export type ResolvedTheme = "light" | "dark"

type ThemeContextValue = {
  glassTransparency: number
  resolvedTheme: ResolvedTheme
  setGlassTransparency: (value: number) => void
  setTheme: (nextTheme: ThemeMode) => void
  theme: ThemeMode
}

export const themeStorageKey = "yeahbuddy-theme"
export const glassTransparencyStorageKey = "yeahbuddy-glass-transparency"
export const defaultGlassTransparency = 42
export const minGlassTransparency = 10
export const maxGlassTransparency = 70
const darkQuery = "(prefers-color-scheme: dark)"
const lightThemeColor = "#ffffff"
const darkThemeColor = "#0b0d12"
const glassThemeColor = "#111015"
const defaultTheme: ThemeMode = "light"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "glass" || value === "system"
}

function getStoredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey)
    return isThemeMode(storedTheme) ? storedTheme : defaultTheme
  } catch {
    return defaultTheme
  }
}

function clampGlassTransparency(value: number) {
  return Math.min(maxGlassTransparency, Math.max(minGlassTransparency, Math.round(value)))
}

function getStoredGlassTransparency() {
  try {
    const rawStoredValue = window.localStorage.getItem(glassTransparencyStorageKey)
    if (rawStoredValue === null) return defaultGlassTransparency
    const storedValue = Number(rawStoredValue)
    return Number.isFinite(storedValue) ? clampGlassTransparency(storedValue) : defaultGlassTransparency
  } catch {
    return defaultGlassTransparency
  }
}

function applyGlassTransparencyToDocument(value: number) {
  const opacity = (100 - clampGlassTransparency(value)) / 100
  document.documentElement.style.setProperty("--glass-opacity", opacity.toFixed(2))
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "glass") {
    return "dark"
  }

  if (theme !== "system") {
    return theme
  }

  return window.matchMedia?.(darkQuery).matches ? "dark" : "light"
}

function applyThemeToDocument(theme: ThemeMode, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.classList.toggle("glass", theme === "glass")
  root.style.colorScheme = resolvedTheme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeColor?.setAttribute(
    "content",
    theme === "glass" ? glassThemeColor : resolvedTheme === "dark" ? darkThemeColor : lightThemeColor,
  )
}

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: ThemeMode }) {
  const startingTheme = initialTheme ?? defaultTheme
  const [theme, setThemeState] = useState<ThemeMode>(startingTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(startingTheme === "dark" || startingTheme === "glass" ? "dark" : "light")
  const [glassTransparency, setGlassTransparencyState] = useState(defaultGlassTransparency)
  const themeRef = useRef<ThemeMode>(startingTheme)

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    const nextResolvedTheme = resolveTheme(nextTheme)
    applyThemeToDocument(nextTheme, nextResolvedTheme)
    setResolvedTheme(nextResolvedTheme)
  }, [])

  useEffect(() => {
    const startupTheme = initialTheme ?? getStoredTheme()
    const storedGlassTransparency = getStoredGlassTransparency()
    themeRef.current = startupTheme
    setThemeState(startupTheme)
    setGlassTransparencyState(storedGlassTransparency)
    applyGlassTransparencyToDocument(storedGlassTransparency)
    applyTheme(startupTheme)

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
  }, [applyTheme, initialTheme])

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

  const setGlassTransparency = useCallback((value: number) => {
    const nextValue = clampGlassTransparency(value)
    setGlassTransparencyState(nextValue)
    applyGlassTransparencyToDocument(nextValue)

    try {
      window.localStorage.setItem(glassTransparencyStorageKey, String(nextValue))
    } catch {
      // Persisting appearance preferences is best-effort.
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      glassTransparency,
      resolvedTheme,
      setGlassTransparency,
      setTheme,
      theme,
    }),
    [glassTransparency, resolvedTheme, setGlassTransparency, setTheme, theme],
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
