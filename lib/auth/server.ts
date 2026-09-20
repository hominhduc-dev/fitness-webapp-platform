import { redirect } from "next/navigation"
import { cache } from "react"

import type { AppProfile, AppRole } from "./types"
import { getRoleLandingPath } from "./roles"
import { ApiError, fetchCurrentProfile } from "./api"
import { createServerSupabaseClient } from "@/lib/supabase/server"
// Side effect: server-side API calls made after auth carry the user's time zone.
import "@/lib/time-zone-server"

type ServerAuthState = {
  accessToken: string | null
  profile: AppProfile | null
}

const getServerAuthState = cache(async (): Promise<ServerAuthState> => {
  const supabase = await createServerSupabaseClient()

  let sessionResult
  try {
    const {
      data: { session },
      // `getSession()` can read directly from the request cookies, so we avoid
      // a blocking round-trip to Supabase before fetching the profile.
    } = await supabase.auth.getSession()
    sessionResult = session
  } catch {
    // Reading the session itself failed — there is no token to fall back on,
    // so this genuinely is a signed-out state.
    return {
      accessToken: null,
      profile: null,
    }
  }

  if (!sessionResult?.access_token) {
    return {
      accessToken: null,
      profile: null,
    }
  }

  try {
    const profile = await fetchCurrentProfile(sessionResult.access_token)

    return {
      accessToken: sessionResult.access_token,
      profile,
    }
  } catch (error) {
    // A 401 means the access token itself is invalid or expired — that is a
    // real sign-out. Anything else (a network blip, a cold backend, a 5xx)
    // must not be treated as one: the Supabase session is still valid, and
    // silently swallowing it here previously caused `requireAppSession` to
    // bounce a signed-in user to the login page whenever the profile fetch
    // merely hiccuped. Let it propagate so the route's error boundary can
    // show a retryable error instead.
    if (error instanceof ApiError && error.status === 401) {
      return {
        accessToken: null,
        profile: null,
      }
    }

    throw error
  }
})

async function requireAppUser(options?: { redirectTo?: string; role?: AppRole }) {
  const { profile } = await requireAppSession(options)
  return profile
}

async function requireAppSession(options?: { redirectTo?: string; role?: AppRole }) {
  const authState = await getServerAuthState()
  const redirectTo = options?.redirectTo ?? "/?auth=login"

  if (!authState.accessToken || !authState.profile) {
    redirect(redirectTo)
  }

  if (options?.role && authState.profile.role !== options.role) {
    redirect(getRoleLandingPath(authState.profile.role))
  }

  return {
    accessToken: authState.accessToken,
    profile: authState.profile,
  }
}

export { getServerAuthState, requireAppSession, requireAppUser }
