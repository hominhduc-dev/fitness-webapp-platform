import { createClient } from "@supabase/supabase-js"

import { env } from "../config/env"

function hasConfiguredValue(value?: string) {
  if (!value) {
    return false
  }

  return !value.includes("[YOUR_") && !value.startsWith("your-")
}

function hasValidSupabaseUrl(value?: string) {
  if (!value || !hasConfiguredValue(value)) {
    return false
  }

  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const supabaseUrlConfigured = hasValidSupabaseUrl(env.supabaseUrl)
const hasAnonKey = hasConfiguredValue(env.supabaseAnonKey)
const hasServiceRoleKey = hasConfiguredValue(env.supabaseServiceRoleKey)
const supabaseUrl = supabaseUrlConfigured ? env.supabaseUrl : undefined

function createConfiguredClient(key?: string) {
  if (!supabaseUrl || !key) {
    return null
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

const supabasePublic = hasAnonKey ? createConfiguredClient(env.supabaseAnonKey) : null
const supabaseAdmin = hasServiceRoleKey ? createConfiguredClient(env.supabaseServiceRoleKey) : null

const supabaseStatus = {
  configured: Boolean(supabasePublic || supabaseAdmin),
  hasAnonKey,
  hasServiceRoleKey,
  urlConfigured: supabaseUrlConfigured,
}

export { supabaseAdmin, supabasePublic, supabaseStatus }
