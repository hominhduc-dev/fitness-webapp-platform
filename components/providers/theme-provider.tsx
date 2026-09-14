"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

export type PaletteTheme =
  | "performance-green"
  | "electric-blue"
  | "volt-lime"
  | "iron-orange"
  | "black-volt"
  | "crimson-performance"
export type ThemeMode = "light" | PaletteTheme | "dark" | "system"
export type ResolvedTheme = Exclude<ThemeMode, "system">

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme: (nextTheme: ThemeMode) => void
  theme: ThemeMode
}

export const themeStorageKey = "yeahbuddy-theme"
const darkQuery = "(prefers-color-scheme: dark)"
const lightThemeColor = "#e8ecf3"
const darkThemeColor = "#080a0f"
const defaultTheme: ThemeMode = "light"
const paletteThemes: readonly PaletteTheme[] = [
  "performance-green",
  "electric-blue",
  "volt-lime",
  "iron-orange",
  "black-volt",
  "crimson-performance",
]

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system" || paletteThemes.includes(value as PaletteTheme)
}

/**
 * "glass" and "midnight" used to be extra themes. Both were dark-family
 * palettes, so they migrate to dark rather than silently dropping anyone who
 * had them selected back to light. The same migration runs in the pre-paint
 * script in app/layout.tsx, which has to make the identical decision before
 * React boots.
 */
function migrateStoredTheme(value: string | null): ThemeMode {
  if (value === "glass" || value === "midnight") return "dark"
  if (value === "sport") return "electric-blue"
  return isThemeMode(value) ? value : defaultTheme
}

function getStoredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey)
    const migrated = migrateStoredTheme(storedTheme)

    if (storedTheme !== null && storedTheme !== migrated) {
      window.localStorage.setItem(themeStorageKey, migrated)
    }

    return migrated
  } catch {
    return defaultTheme
  }
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme !== "system") {
    return theme
  }

  return window.matchMedia?.(darkQuery).matches ? "dark" : "light"
}

const themeColors: Record<ResolvedTheme, string> = {
  light: lightThemeColor,
  "performance-green": "#f5f8f6",
  "electric-blue": "#f3f6fc",
  "volt-lime": "#f7f9f3",
  "iron-orange": "#fafaf9",
  "black-volt": "#0d0f0e",
  "crimson-performance": "#f8f8f7",
  dark: darkThemeColor,
}

function isDarkTheme(theme: ResolvedTheme) {
  return theme === "dark" || theme === "black-volt"
}

/**
 * The pre-paint script in app/layout.tsx has to reach the identical result
 * before React boots, so the two must stay in sync.
 */
function applyThemeToDocument(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("sport", ...paletteThemes)
  root.classList.toggle("dark", isDarkTheme(resolvedTheme))
  if (paletteThemes.includes(resolvedTheme as PaletteTheme)) {
    root.classList.add(resolvedTheme)
  }
  root.style.colorScheme = isDarkTheme(resolvedTheme) ? "dark" : "light"

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeColor?.setAttribute("content", themeColors[resolvedTheme])
}

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: ThemeMode }) {
  const startingTheme = initialTheme ?? defaultTheme
  const [theme, setThemeState] = useState<ThemeMode>(startingTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    startingTheme === "system" ? "light" : startingTheme,
  )
  const themeRef = useRef<ThemeMode>(startingTheme)

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    const nextResolvedTheme = resolveTheme(nextTheme)
    applyThemeToDocument(nextResolvedTheme)
    setResolvedTheme(nextResolvedTheme)
  }, [])

  useEffect(() => {
    const startupTheme = initialTheme ?? getStoredTheme()
    themeRef.current = startupTheme
    setThemeState(startupTheme)
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
