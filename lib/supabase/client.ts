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
