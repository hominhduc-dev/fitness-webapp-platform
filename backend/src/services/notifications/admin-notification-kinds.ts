/**
 * Identifiers for admin notices, kept free of imports so the push delivery
 * code can read them without pulling in the dispatch module (which imports it).
 */
export const COACH_SIGNUP_PENDING_KIND = "coach_signup_pending"
/** One push tag for all of them, so a newer notice replaces the last on the device. */
export const COACH_SIGNUP_PUSH_TAG = "coach-signups"
