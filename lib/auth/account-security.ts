"use client"

import { createClient } from "@supabase/supabase-js"
import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"
import { getSupabasePublicConfig } from "@/lib/supabase/config"

export const MIN_PASSWORD_LENGTH = 6

export class CurrentPasswordError extends Error {}
export class NotSignedInError extends Error {}

function requireClient() {
  const client = getOptionalBrowserSupabaseClient()
  if (!client) throw new Error("Supabase is not configured.")
  return client
}

export async function verifyCurrentPassword(password: string) {
  const client = requireClient()

  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user?.email) throw new NotSignedInError("You are not signed in with an email account.")

  // A disposable, non-persistent client checks the old password without
  // replacing the application's active session. Revoke its temporary session.
  const { publishableKey, url } = getSupabasePublicConfig()
  const verifier = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password })
  if (error || !data.user || data.user.id !== user.id) {
    if (data.session) await verifier.auth.signOut({ scope: "local" })
    throw new CurrentPasswordError("The current password is incorrect.")
  }

  const { error: cleanupError } = await verifier.auth.signOut({ scope: "local" })
  if (cleanupError) throw cleanupError
  return client
}

/**
 * Whether the current session came from a password-recovery email link.
 *
 * Someone who forgot their password cannot type the old one, so only that
 * session may set a new password without it. Every other session must prove
 * the current password first.
 */
export async function isRecoverySession() {
  const client = getOptionalBrowserSupabaseClient()
  if (!client) return false
  const { data, error } = await client.auth.getClaims()
  if (error || !data) return false
  const amr = (data.claims.amr ?? []) as Array<string | { method: string }>
  const methods = amr.map((entry) => (typeof entry === "string" ? entry : entry.method))
  return methods.includes("recovery") || methods.includes("otp")
}

export async function hasActiveSession() {
  const client = getOptionalBrowserSupabaseClient()
  if (!client) return false
  const { data } = await client.auth.getSession()
  return Boolean(data.session)
}

/**
 * Sets a new password. `currentPassword` is required unless the session is a
 * recovery session, which the caller decides with `isRecoverySession`.
 */
export async function changePassword(input: { currentPassword?: string; newPassword: string }) {
  const client = input.currentPassword != null ? await verifyCurrentPassword(input.currentPassword) : requireClient()
  const { error } = await client.auth.updateUser({
    password: input.newPassword,
    ...(input.currentPassword != null ? { current_password: input.currentPassword } : {}),
  })
  if (error) throw error
}

/**
 * Revokes every refresh token of the account. Other devices lose the session
 * when their current access token expires (at most the JWT lifetime).
 */
export async function signOutEveryDevice() {
  const client = requireClient()
  const { error } = await client.auth.signOut({ scope: "global" })
  if (error) throw error
}

/** A full page load, so no signed-in client state survives into the login screen. */
export function reloadToLogin(delayMs: number) {
  window.setTimeout(() => {
    window.location.assign(new URL("/?auth=login", window.location.origin).toString())
  }, delayMs)
}
