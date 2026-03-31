import dotenv from "dotenv"

dotenv.config()

const rawPort = Number(process.env.PORT ?? 4000)
const rawUsdaTimeoutMs = Number(process.env.USDA_TIMEOUT_MS ?? 8000)

if (!Number.isInteger(rawPort) || rawPort <= 0) {
  throw new Error("PORT must be a positive integer")
}

if (!Number.isFinite(rawUsdaTimeoutMs) || rawUsdaTimeoutMs <= 0) {
  throw new Error("USDA_TIMEOUT_MS must be a positive number")
}

function hasValue(value?: string) {
  return typeof value === "string" && value.trim().length > 0
}

function isHttpUrl(value?: string) {
  return hasValue(value) && /^https?:\/\//i.test(value ?? "")
}

function isPostgresUrl(value?: string) {
  return hasValue(value) && /^postgres(?:ql)?:\/\//i.test(value ?? "")
}

function projectRefFromPostgresUrl(value?: string) {
  if (!isPostgresUrl(value)) {
    return undefined
  }

  const match = value?.match(/postgres(?:\.([a-z0-9-]+))?:.*?(?:db\.([a-z0-9-]+)\.supabase\.co|pooler\.supabase\.com)/i)
  const ref = match?.[1] ?? match?.[2]
  return ref?.toLowerCase()
}

function inferSupabaseUrl() {
  if (isHttpUrl(process.env.SUPABASE_URL)) {
    return process.env.SUPABASE_URL
  }

  if (isHttpUrl(process.env.DATABASE_URL)) {
    return process.env.DATABASE_URL
  }

  const projectRef = projectRefFromPostgresUrl(process.env.DIRECT_URL) ?? projectRefFromPostgresUrl(process.env.DATABASE_URL)

  if (!projectRef) {
    return undefined
  }

  return `https://${projectRef}.supabase.co`
}

function inferDatabaseUrl() {
  if (isPostgresUrl(process.env.DATABASE_URL)) {
    return process.env.DATABASE_URL
  }

  if (isPostgresUrl(process.env.DIRECT_URL)) {
    return process.env.DIRECT_URL
  }

  return undefined
}

function inferDirectUrl() {
  if (isPostgresUrl(process.env.DIRECT_URL)) {
    return process.env.DIRECT_URL
  }

  if (isPostgresUrl(process.env.DATABASE_URL)) {
    return process.env.DATABASE_URL
  }

  return undefined
}

export const env = {
  databaseUrl: inferDatabaseUrl(),
  directUrl: inferDirectUrl(),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: rawPort,
  usdaApiBaseUrl: process.env.USDA_API_BASE_URL ?? "https://api.nal.usda.gov/fdc/v1",
  usdaApiKey: process.env.USDA_API_KEY,
  usdaTimeoutMs: rawUsdaTimeoutMs,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrl: inferSupabaseUrl(),
}
