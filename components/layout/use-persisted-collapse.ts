"use client"

import { useCallback, useSyncExternalStore } from "react"

const CHANGE_EVENT = "yeahbuddy-collapse-change"
const fallback = new Map<string, boolean>()

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/** UI preferences only; the server snapshot keeps hydration consistent. */
export function usePersistedCollapse(key: string) {
  const read = useCallback(() => {
    try {
      return window.localStorage.getItem(key) === "true"
    } catch {
      return fallback.get(key) ?? false
    }
  }, [key])
  const collapsed = useSyncExternalStore(subscribe, read, () => false)
  const toggle = useCallback(() => {
    const next = !read()
    fallback.set(key, next)
    try {
      window.localStorage.setItem(key, String(next))
    } catch {
      // Storage may be disabled by the browser.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [key, read])
  return [collapsed, toggle] as const
}
