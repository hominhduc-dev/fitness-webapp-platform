import { redirect } from "next/navigation"

import type { AppProfile, AppRole } from "./types"
import { getRoleLandingPath } from "./roles"
import { fetchCurrentProfile } from "./api"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ServerAuthState = {
  accessToken: string | null
  profile: AppProfile | null
}

async function getServerAuthState(): Promise<ServerAuthState> {
  const supabase = await createServerSupabaseClient()
  const [{ data: userResult }, { data: sessionResult }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  if (!userResult.user || !sessionResult.session?.access_token) {
    return {
      accessToken: null,
      profile: null,
    }
  }

  try {
    const profile = await fetchCurrentProfile(sessionResult.session.access_token)

    return {
      accessToken: sessionResult.session.access_token,
      profile,
    }
  } catch {
    return {
      accessToken: sessionResult.session.access_token,
      profile: null,
    }
  }
}

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
