"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * How the session screen lays out the exercises: one page per exercise, or the
 * current exercise on top of a queue of the ones still to do.
 */
export const SESSION_LAYOUTS = ["single", "stack"] as const
export type SessionLayout = (typeof SESSION_LAYOUTS)[number]

/** The layout every trainee starts with. */
export const DEFAULT_SESSION_LAYOUT: SessionLayout = "single"

/** Same-tab writes; the `storage` event only reports other tabs. */
const CHANGE_EVENT = "session-layout-change"

export function sessionLayoutStorageKey(userId: string) {
  return `session-layout:${userId}`
}

/** A stored value back to a layout; anything unknown reads as the default. */
export function parseSessionLayout(value: string | null | undefined): SessionLayout {
  return (SESSION_LAYOUTS as ReadonlyArray<string>).includes(value ?? "")
    ? (value as SessionLayout)
    : DEFAULT_SESSION_LAYOUT
}

export function readSessionLayout(userId: string | null): SessionLayout {
  if (!userId) return DEFAULT_SESSION_LAYOUT
  try {
    return parseSessionLayout(window.localStorage.getItem(sessionLayoutStorageKey(userId)))
  } catch {
    // Storage blocked (private mode, site data off): the default still works.
    return DEFAULT_SESSION_LAYOUT
  }
}

export function writeSessionLayout(userId: string | null, layout: SessionLayout) {
  if (!userId) return
  try {
    window.localStorage.setItem(sessionLayoutStorageKey(userId), layout)
  } catch {
    // Storage blocked: the choice holds until the page is left.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * The trainee's session layout, kept on this device per account, like the
 * default rest (see `useDefaultRest`).
 */
export function useSessionLayout(userId: string | null) {
  const layout = useSyncExternalStore(
    subscribe,
    () => readSessionLayout(userId),
    () => DEFAULT_SESSION_LAYOUT,
  )

  const update = useCallback((next: SessionLayout) => writeSessionLayout(userId, next), [userId])

  return [layout, update] as const
}
