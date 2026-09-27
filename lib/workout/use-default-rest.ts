"use client"

import { useCallback, useSyncExternalStore } from "react"

/** The choices the session options sheet offers, in seconds. */
export const DEFAULT_REST_OPTIONS = [60, 90, 120, 180] as const
export type DefaultRestSeconds = (typeof DEFAULT_REST_OPTIONS)[number]

/** Rest used when neither the coach nor the trainee has picked one. */
export const FALLBACK_REST_SECONDS: DefaultRestSeconds = 90

/** Same-tab writes; the `storage` event only reports other tabs. */
const CHANGE_EVENT = "default-rest-change"

function storageKey(userId: string) {
  return `rest-default:${userId}`
}

function readDefaultRest(userId: string | null): DefaultRestSeconds {
  if (!userId) return FALLBACK_REST_SECONDS
  try {
    const stored = Number(window.localStorage.getItem(storageKey(userId)))
    return (DEFAULT_REST_OPTIONS as ReadonlyArray<number>).includes(stored)
      ? (stored as DefaultRestSeconds)
      : FALLBACK_REST_SECONDS
  } catch {
    // Storage blocked (private mode, site data off): the fallback still works.
    return FALLBACK_REST_SECONDS
  }
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
 * The trainee's default rest between sets, kept on this device. It only fills
 * in for exercises the coach gave no rest time; a coach's `restTime` wins.
 */
export function useDefaultRest(userId: string | null) {
  const seconds = useSyncExternalStore(
    subscribe,
    () => readDefaultRest(userId),
    () => FALLBACK_REST_SECONDS,
  )

  const update = useCallback(
    (next: DefaultRestSeconds) => {
      if (!userId) return
      try {
        window.localStorage.setItem(storageKey(userId), String(next))
      } catch {
        // Storage blocked: the choice cannot be kept.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [userId],
  )

  return [seconds, update] as const
}
