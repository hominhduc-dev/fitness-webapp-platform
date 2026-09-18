"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getSupabasePublicConfig, getSupabasePublicConfigError, hasSupabasePublicConfig } from "./config"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getOptionalBrowserSupabaseClient() {
  if (typeof window === "undefined" || !hasSupabasePublicConfig()) {
    return null
  }

  if (browserClient) {
    return browserClient
  }

  const { publishableKey, url } = getSupabasePublicConfig()

  browserClient = createBrowserClient(url, publishableKey)
  return browserClient
}

export function createBrowserSupabaseClient() {
  const client = getOptionalBrowserSupabaseClient()

  if (!client) {
    throw new Error(
      getSupabasePublicConfigError() ?? "Supabase browser client is only available in the browser.",
    )
  }

  return client
}

/**
 * Whether Supabase still holds credentials for this device.
 *
 * `@supabase/ssr` keeps the session in a cookie so the server can read it too,
 * and signing out deletes that cookie. A missing session while the cookie is
 * still present therefore means a refresh could not run — almost always because
 * there is no network — rather than that the user signed out. `navigator.onLine`
 * cannot make that distinction: gym Wi-Fi with a dead uplink reports `true`.
 */
export function hasStoredSupabaseSession() {
  if (typeof document === "undefined") return false
  return document.cookie
    .split("; ")
    // Long sessions are split across `.0`, `.1` … chunks; any chunk proves the
    // cookie was not cleared.
    .some((entry) => /^sb-[^=]*-auth-token(?:\.\d+)?=./.test(entry))
}
