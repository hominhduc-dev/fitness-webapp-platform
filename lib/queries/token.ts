import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"

/**
 * Reads a fresh access token at call time rather than from React state.
 *
 * Query functions must not close over `session.access_token` from `useAuth()`:
 * the token is `undefined` on the first client render and Supabase rotates it
 * roughly hourly, so a captured value is either missing or stale. Keying queries
 * on the token instead would evict the whole cache on every rotation.
 *
 * `getOptionalBrowserSupabaseClient()` is a module-level singleton and
 * `getSession()` reads from its in-memory session, refreshing only when expired,
 * so calling this per query function is cheap. `updateProfile`, `uploadAvatar`
 * and `refreshProfile` in the auth provider already resolve the token this way.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getOptionalBrowserSupabaseClient()

  if (!supabase) {
    return null
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

/**
 * The signed-out case is a programming error inside a query function: queries
 * that need a token are gated on the profile being present, so reaching here
 * means the gate is missing.
 */
export async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error("No access token available.")
  }

  return accessToken
}
