import type { AppProfile } from "@/lib/auth/types"

/** Set when someone dismisses the wizard, so the shell stops redirecting them into it. */
const ONBOARDING_SKIP_COOKIE = "yb_onboarding_skipped"
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

/**
 * Whether the profile carries the three fields the rest of the app reads back.
 *
 * BMI, the BMR/TDEE card on Progress and the AI generator's volume sizing all
 * need sex, age and height; without them those surfaces render an empty state.
 * Weight, activity level and goals are asked too, but each has a usable default
 * or its own screen to fill later, so they do not hold the gate open.
 */
function isProfileOnboarded(profile: Pick<AppProfile, "birthDate" | "heightCm" | "sex">) {
  return Boolean(profile.sex && profile.birthDate && profile.heightCm)
}

/** Client-side: a cookie, not localStorage, because the shell layout reads it during SSR. */
function skipOnboarding() {
  document.cookie = `${ONBOARDING_SKIP_COOKIE}=1; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
}

export { isProfileOnboarded, skipOnboarding, ONBOARDING_SKIP_COOKIE }
