import { redirect } from "next/navigation"
import { cache } from "react"

import type { AppProfile, AppRole } from "./types"
import { getRoleLandingPath } from "./roles"
import { fetchCurrentProfile } from "./api"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ServerAuthState = {
  accessToken: string | null
  profile: AppProfile | null
}

const getServerAuthState = cache(async (): Promise<ServerAuthState> => {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { session: sessionResult },
    } = await supabase.auth.getSession()

    // `getSession()` can read directly from the request cookies, so we avoid
    // a blocking round-trip to Supabase before fetching the profile.
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
    } catch {
      return {
        accessToken: sessionResult.access_token,
        profile: null,
      }
    }
  } catch {
    return {
      accessToken: null,
      profile: null,
    }
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
