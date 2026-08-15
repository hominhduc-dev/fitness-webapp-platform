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
const lightThemeColor = "#ffffff"
const darkThemeColor = "#0b0c10"
const defaultTheme: ThemeMode = "light"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

/**
 * "glass" used to be a third theme. The liquid-glass material is now how every
 * theme looks, so the mode is gone — but it resolved to dark, and anyone who
 * had it selected would silently land on light without this rewrite. The same
 * migration runs in the pre-paint script in app/layout.tsx, which has to make
 * the identical decision before React boots.
 */
function migrateStoredTheme(value: string | null): ThemeMode {
  if (value === "glass") return "dark"
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

function applyThemeToDocument(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeColor?.setAttribute("content", resolvedTheme === "dark" ? darkThemeColor : lightThemeColor)
}

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: ThemeMode }) {
  const startingTheme = initialTheme ?? defaultTheme
  const [theme, setThemeState] = useState<ThemeMode>(startingTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(startingTheme === "dark" ? "dark" : "light")
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
