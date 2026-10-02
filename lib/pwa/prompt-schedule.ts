const DAY_MS = 86_400_000

type PromptScheduleState = { dismissals: number; snoozedUntil: number }

/**
 * A soft-ask that backs off. Dismissal n (1-indexed) snoozes it for
 * `snoozeDays[n - 1]` days; once the list runs out it stops asking, since a
 * third "not now" is an answer. State lives in localStorage under `storageKey`.
 */
function createPromptSchedule(storageKey: string, snoozeDays: readonly number[]) {
  const silenced: PromptScheduleState = { dismissals: snoozeDays.length + 1, snoozedUntil: Number.MAX_SAFE_INTEGER }

  function read(): PromptScheduleState | null {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return null

      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null) return null

      const { dismissals, snoozedUntil } = parsed as Partial<PromptScheduleState>
      if (typeof dismissals !== "number" || typeof snoozedUntil !== "number") return null

      return { dismissals, snoozedUntil }
    } catch {
      // Private-mode Safari throws on access; treat it as "never asked".
      return null
    }
  }

  function write(state: PromptScheduleState) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Without storage the prompt reappears next visit, which is acceptable.
    }
  }

  return {
    /** True when the ask may be shown: never dismissed, or the snooze has expired. */
    canShow(now = Date.now()): boolean {
      const state = read()
      if (!state) return true
      if (state.dismissals > snoozeDays.length) return false
      return now >= state.snoozedUntil
    },
    /** Records a "not now" and pushes the next ask out by the next snooze window. */
    snooze(now = Date.now()) {
      const dismissals = (read()?.dismissals ?? 0) + 1
      const days = snoozeDays[dismissals - 1]
      write(days === undefined ? silenced : { dismissals, snoozedUntil: now + days * DAY_MS })
    },
    /** Settles the question for good. */
    stop() {
      write(silenced)
    },
    /** Clears the record so the prompt behaves as if it had never been shown. */
    reset() {
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Nothing to clear when storage is unavailable.
      }
    },
  }
}

export { createPromptSchedule }
export type { PromptScheduleState }
