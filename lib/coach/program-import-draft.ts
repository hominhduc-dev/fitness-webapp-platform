/**
 * An import the coach has reached Review on but not created yet, kept in this
 * browser so an accidental close, a refresh or a dropped connection does not
 * throw away the edits (or the AI read of an image) already made.
 *
 * Per coach, one at a time, for a week. It is a convenience, not a record:
 * anything that fails to read back is treated as no draft.
 */

const STORAGE_PREFIX = "yeahbuddy:program-import-draft:"
const VERSION = 1
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredImportDraft<T> = { version: number; savedAt: number; state: T }

function storageKey(coachId: string) {
  return `${STORAGE_PREFIX}${coachId}`
}

function readImportDraft<T>(coachId: string, now = Date.now()): { savedAt: number; state: T } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(coachId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredImportDraft<T>
    if (parsed?.version !== VERSION || typeof parsed.savedAt !== "number" || !parsed.state) return null
    if (now - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(storageKey(coachId))
      return null
    }
    return { savedAt: parsed.savedAt, state: parsed.state }
  } catch {
    return null
  }
}

function writeImportDraft<T>(coachId: string, state: T, now = Date.now()) {
  try {
    const stored: StoredImportDraft<T> = { savedAt: now, state, version: VERSION }
    window.localStorage.setItem(storageKey(coachId), JSON.stringify(stored))
  } catch {
    // Private mode or a full quota: the import still works, it just won't survive a close.
  }
}

function clearImportDraft(coachId: string) {
  try {
    window.localStorage.removeItem(storageKey(coachId))
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export { clearImportDraft, readImportDraft, writeImportDraft }
