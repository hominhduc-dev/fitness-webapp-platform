function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function getSupabasePublicConfigError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL"
  }

  if (!getSupabasePublishableKey()) {
    return "Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  }

  return null
}

export function hasSupabasePublicConfig() {
  return getSupabasePublicConfigError() === null
}

export function getSupabasePublicConfig() {
  const url = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL")
  const publishableKey = getSupabasePublishableKey()

  return {
    publishableKey: requireEnv(
      publishableKey,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    url,
  }
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "/backend"
  }

  return process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
