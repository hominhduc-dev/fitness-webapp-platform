const STORAGE_KEY = "yeahbuddy:push-prompt"
const DAY_MS = 86_400_000

/**
 * Dismissal n (1-indexed) snoozes the prompt for SNOOZE_DAYS[n - 1] days. Once the
 * list runs out the app stops asking: a third "not now" is an answer, and browsers
 * treat repeated soft-asks as spam.
 */
const SNOOZE_DAYS = [3, 14]

type PushPromptState = { dismissals: number; snoozedUntil: number }

const SILENCED: PushPromptState = { dismissals: SNOOZE_DAYS.length + 1, snoozedUntil: Number.MAX_SAFE_INTEGER }

function readState(): PushPromptState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const { dismissals, snoozedUntil } = parsed as Partial<PushPromptState>
    if (typeof dismissals !== "number" || typeof snoozedUntil !== "number") return null

    return { dismissals, snoozedUntil }
  } catch {
    // Private-mode Safari throws on access; treat it as "never asked".
    return null
  }
}

function writeState(state: PushPromptState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Without storage the prompt reappears next visit, which is acceptable.
  }
}

/** True when the soft-ask may be shown again: never dismissed, or the snooze has expired. */
function canShowPushPrompt(now = Date.now()): boolean {
  const state = readState()
  if (!state) return true
  if (state.dismissals > SNOOZE_DAYS.length) return false
  return now >= state.snoozedUntil
}

/** Records a "not now" and pushes the next ask out by the next snooze window. */
function snoozePushPrompt(now = Date.now()) {
  const dismissals = (readState()?.dismissals ?? 0) + 1
  const snoozeDays = SNOOZE_DAYS[dismissals - 1]
  writeState(
    snoozeDays === undefined
      ? SILENCED
      : { dismissals, snoozedUntil: now + snoozeDays * DAY_MS },
  )
}

/** Settles the question for good — the user granted or blocked notifications. */
function stopAskingForPushPrompt() {
  writeState(SILENCED)
}

/** Clears the record so the prompt behaves as if it had never been shown. */
function resetPushPrompt() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export { canShowPushPrompt, resetPushPrompt, snoozePushPrompt, stopAskingForPushPrompt }
export type { PushPromptState }
