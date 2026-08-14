import dotenv from "dotenv"
import { z } from "zod"

/**
 * Set ENV_SKIP_DOTENV=1 to read configuration from the process environment only.
 *
 * The test suite relies on this: loading the developer's real `.env` would make
 * results machine-dependent and pull live credentials into test output. It is also
 * the correct setting for containers, where the orchestrator injects the variables
 * and a stray .env in the image should never win.
 */
if (process.env.ENV_SKIP_DOTENV !== "1") {
  dotenv.config()
}

/**
 * `.env.example` ships placeholder values like `[YOUR_PROJECT_REF]`. Treating them
 * as "set" is worse than treating them as missing: the app boots and then fails on
 * the first request instead of at startup. Everything below normalizes them away.
 */
const PLACEHOLDER_PATTERNS = [/^\[your_/i, /^your-/i, /^<.*>$/, /^changeme$/i]

function clean(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed)) ? undefined : trimmed
}

function isPostgresUrl(value: string | undefined) {
  return Boolean(value && /^postgres(?:ql)?:\/\//i.test(value))
}

function isHttpUrl(value: string | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

/**
 * Supabase project ref can be recovered from either connection string, which lets a
 * deployment configure only DATABASE_URL/DIRECT_URL and still reach the Auth API.
 */
function projectRefFromPostgresUrl(value: string | undefined) {
  if (!isPostgresUrl(value)) {
    return undefined
  }

  const match = value?.match(/postgres(?:\.([a-z0-9-]+))?:.*?(?:db\.([a-z0-9-]+)\.supabase\.co|pooler\.supabase\.com)/i)
  return (match?.[1] ?? match?.[2])?.toLowerCase()
}

function inferSupabaseUrl(raw: Record<string, string | undefined>) {
  if (isHttpUrl(raw.SUPABASE_URL)) {
    return raw.SUPABASE_URL
  }

  const projectRef = projectRefFromPostgresUrl(raw.DIRECT_URL) ?? projectRefFromPostgresUrl(raw.DATABASE_URL)
  return projectRef ? `https://${projectRef}.supabase.co` : undefined
}

const raw = {
  AI_API_KEY: clean(process.env.AI_API_KEY),
  AI_BASE_URL: clean(process.env.AI_BASE_URL),
  AI_JSON_MODE: clean(process.env.AI_JSON_MODE),
  AI_MODEL: clean(process.env.AI_MODEL),
  AI_PROVIDER: clean(process.env.AI_PROVIDER),
  ANTHROPIC_API_KEY: clean(process.env.ANTHROPIC_API_KEY),
  DATABASE_URL: clean(process.env.DATABASE_URL),
  DIRECT_URL: clean(process.env.DIRECT_URL),
  FRONTEND_URL: clean(process.env.FRONTEND_URL),
  LOG_LEVEL: clean(process.env.LOG_LEVEL),
  N8N_LOGS_WEBHOOK_URL: clean(process.env.N8N_LOGS_WEBHOOK_URL),
  NODE_ENV: clean(process.env.NODE_ENV),
  OPENAI_API_KEY: clean(process.env.OPENAI_API_KEY),
  PORT: clean(process.env.PORT),
  PRISMA_SLOW_QUERY_MS: clean(process.env.PRISMA_SLOW_QUERY_MS),
  SUPABASE_ANON_KEY: clean(process.env.SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  SUPABASE_URL: clean(process.env.SUPABASE_URL),
  USDA_API_BASE_URL: clean(process.env.USDA_API_BASE_URL),
  USDA_API_KEY: clean(process.env.USDA_API_KEY),
  USDA_TIMEOUT_MS: clean(process.env.USDA_TIMEOUT_MS),
}

const postgresUrl = z.string().regex(/^postgres(?:ql)?:\/\//i, "must be a postgres:// or postgresql:// connection string")

const numberFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : Number(value)))

const envSchema = z.object({
  /** Generic fallback key, used when AI_PROVIDER=openai against an OpenAI-compatible host. */
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.url().optional(),
  AI_JSON_MODE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AI_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: postgresUrl.optional(),
  DIRECT_URL: postgresUrl.optional(),
  // Comma-separated so a deployment can allow prod + preview origins at once.
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  N8N_LOGS_WEBHOOK_URL: z.url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().optional(),
  PORT: numberFromString(4000).pipe(z.int().positive("PORT must be a positive integer")),
  PRISMA_SLOW_QUERY_MS: numberFromString(0).pipe(z.number().min(0, "PRISMA_SLOW_QUERY_MS must be >= 0")),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_URL: z.url().optional(),
  USDA_API_BASE_URL: z.url().default("https://api.nal.usda.gov/fdc/v1"),
  USDA_API_KEY: z.string().optional(),
  USDA_TIMEOUT_MS: numberFromString(8000).pipe(z.number().positive("USDA_TIMEOUT_MS must be > 0")),
})

type ParsedEnv = z.infer<typeof envSchema>

/**
 * Anything the service genuinely cannot serve a request without. Enforced in
 * production only, so local development can still boot against a partial `.env`.
 */
function collectProductionGaps(parsed: ParsedEnv) {
  const gaps: string[] = []

  if (!parsed.DATABASE_URL) gaps.push("DATABASE_URL — every route reads through Prisma")
  if (!parsed.SUPABASE_URL) gaps.push("SUPABASE_URL — required to verify access tokens")
  if (!parsed.SUPABASE_SERVICE_ROLE_KEY) gaps.push("SUPABASE_SERVICE_ROLE_KEY — required for admin auth operations")
  if (!parsed.SUPABASE_ANON_KEY) gaps.push("SUPABASE_ANON_KEY — required for sign-in and sign-up")

  if (parsed.AI_PROVIDER === "anthropic" && !parsed.ANTHROPIC_API_KEY) {
    gaps.push("ANTHROPIC_API_KEY — AI_PROVIDER is 'anthropic'")
  }

  if (parsed.AI_PROVIDER === "openai" && !parsed.OPENAI_API_KEY && !parsed.AI_API_KEY) {
    gaps.push("OPENAI_API_KEY (or AI_API_KEY) — AI_PROVIDER is 'openai'")
  }

  return gaps
}

function loadEnv() {
  const inferredSupabaseUrl = inferSupabaseUrl(raw)
  const result = envSchema.safeParse({
    ...raw,
    // DATABASE_URL and DIRECT_URL are interchangeable fallbacks for one another.
    DATABASE_URL: raw.DATABASE_URL ?? raw.DIRECT_URL,
    DIRECT_URL: raw.DIRECT_URL ?? raw.DATABASE_URL,
    SUPABASE_URL: inferredSupabaseUrl,
  })

  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    throw new Error(`Invalid environment configuration:\n${details.join("\n")}`)
  }

  const parsed = result.data
  const gaps = collectProductionGaps(parsed)

  if (gaps.length > 0) {
    if (parsed.NODE_ENV === "production") {
      throw new Error(`Missing required environment configuration:\n${gaps.map((gap) => `  - ${gap}`).join("\n")}`)
    }

    console.warn(
      `[env] Running with an incomplete configuration — these would abort a production boot:\n${gaps
        .map((gap) => `  - ${gap}`)
        .join("\n")}`,
    )
  }

  const frontendUrls = parsed.FRONTEND_URL.split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    aiApiKey: parsed.AI_API_KEY,
    aiBaseUrl: parsed.AI_BASE_URL,
    aiJsonMode: parsed.AI_JSON_MODE,
    aiModel: parsed.AI_MODEL,
    aiProvider: parsed.AI_PROVIDER,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    databaseUrl: parsed.DATABASE_URL,
    directUrl: parsed.DIRECT_URL,
    frontendUrl: frontendUrls[0] ?? "http://localhost:3000",
    frontendUrls,
    isProduction: parsed.NODE_ENV === "production",
    isTest: parsed.NODE_ENV === "test",
    logLevel: parsed.LOG_LEVEL,
    n8nLogsWebhookUrl: parsed.N8N_LOGS_WEBHOOK_URL,
    nodeEnv: parsed.NODE_ENV,
    openaiApiKey: parsed.OPENAI_API_KEY,
    port: parsed.PORT,
    // When > 0, Prisma logs every query whose DB execution time meets/exceeds this
    // many milliseconds (set to 1 to log everything). 0 disables instrumentation.
    prismaSlowQueryMs: parsed.PRISMA_SLOW_QUERY_MS,
    supabaseAnonKey: parsed.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: parsed.SUPABASE_URL,
    usdaApiBaseUrl: parsed.USDA_API_BASE_URL,
    usdaApiKey: parsed.USDA_API_KEY,
    usdaTimeoutMs: parsed.USDA_TIMEOUT_MS,
  }
}

const env = loadEnv()

type Env = typeof env

export { env, envSchema, loadEnv }
export type { Env }
