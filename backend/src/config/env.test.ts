import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const REQUIRED_KEYS = [
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_JSON_MODE",
  "AI_MODEL",
  "AI_PROVIDER",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "FRONTEND_URL",
  "LOG_LEVEL",
  "N8N_LOGS_WEBHOOK_URL",
  "NODE_ENV",
  "OPENAI_API_KEY",
  "PORT",
  "PRISMA_SLOW_QUERY_MS",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "USDA_API_BASE_URL",
  "USDA_API_KEY",
  "USDA_TIMEOUT_MS",
] as const

const originalEnv = { ...process.env }

/**
 * `env.ts` reads process.env once at import time, so each scenario needs a fresh
 * module instance. `dotenv.config()` does not overwrite variables that are already
 * set, which is why every key is cleared first.
 */
async function loadWith(overrides: Record<string, string | undefined>) {
  for (const key of REQUIRED_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  vi.resetModules()
  // The .js extension is required by moduleResolution: node16; Vite maps it back to the source.
  return import("./env.js")
}

const productionBase = {
  ANTHROPIC_API_KEY: "sk-ant-test",
  DATABASE_URL: "postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
  NODE_ENV: "production",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  SUPABASE_URL: "https://abcdefghijklm.supabase.co",
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.resetModules()
})

describe("env defaults", () => {
  it("applies documented defaults when nothing is configured", async () => {
    const { env } = await loadWith({ NODE_ENV: "test" })

    expect(env.port).toBe(4000)
    expect(env.aiProvider).toBe("anthropic")
    expect(env.frontendUrl).toBe("http://localhost:3000")
    expect(env.usdaTimeoutMs).toBe(8000)
    expect(env.prismaSlowQueryMs).toBe(0)
  })

  it("parses numeric variables from their string form", async () => {
    const { env } = await loadWith({ NODE_ENV: "test", PORT: "5000", PRISMA_SLOW_QUERY_MS: "250" })

    expect(env.port).toBe(5000)
    expect(env.prismaSlowQueryMs).toBe(250)
  })

  it("splits a comma-separated FRONTEND_URL into a CORS allowlist", async () => {
    const { env } = await loadWith({
      FRONTEND_URL: "https://app.example.com, https://preview.example.com",
      NODE_ENV: "test",
    })

    expect(env.frontendUrls).toEqual(["https://app.example.com", "https://preview.example.com"])
    expect(env.frontendUrl).toBe("https://app.example.com")
  })
})

describe("env placeholder handling", () => {
  it("treats .env.example placeholders as unset instead of as real values", async () => {
    // Booting with DATABASE_URL="[YOUR_DATABASE_URL]" used to fail on the first
    // query rather than at startup.
    const { env } = await loadWith({ DATABASE_URL: "[YOUR_DATABASE_URL]", NODE_ENV: "test" })

    expect(env.databaseUrl).toBeUndefined()
  })

  it("ignores a your- prefixed placeholder", async () => {
    const { env } = await loadWith({ NODE_ENV: "test", SUPABASE_SERVICE_ROLE_KEY: "your-service-role-key" })

    expect(env.supabaseServiceRoleKey).toBeUndefined()
  })
})

describe("env inference", () => {
  it("derives SUPABASE_URL from a pooler connection string", async () => {
    const { env } = await loadWith({
      DIRECT_URL: "postgresql://postgres.abcdefghijklm:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
      NODE_ENV: "test",
    })

    expect(env.supabaseUrl).toBe("https://abcdefghijklm.supabase.co")
  })

  it("prefers an explicit SUPABASE_URL over the inferred one", async () => {
    const { env } = await loadWith({
      DIRECT_URL: "postgresql://postgres.abcdefghijklm:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
      NODE_ENV: "test",
      SUPABASE_URL: "https://explicit.supabase.co",
    })

    expect(env.supabaseUrl).toBe("https://explicit.supabase.co")
  })

  it("falls back between DATABASE_URL and DIRECT_URL in both directions", async () => {
    const url = "postgresql://user:pw@db.abcdefghijklm.supabase.co:5432/postgres"

    expect((await loadWith({ DATABASE_URL: url, NODE_ENV: "test" })).env.directUrl).toBe(url)
    expect((await loadWith({ DIRECT_URL: url, NODE_ENV: "test" })).env.databaseUrl).toBe(url)
  })
})

describe("env validation", () => {
  it("rejects a non-numeric PORT", async () => {
    await expect(loadWith({ NODE_ENV: "test", PORT: "not-a-port" })).rejects.toThrow(/PORT/)
  })

  it("rejects an unknown AI_PROVIDER", async () => {
    await expect(loadWith({ AI_PROVIDER: "gemini", NODE_ENV: "test" })).rejects.toThrow(/AI_PROVIDER/)
  })

  it("rejects a DATABASE_URL that is not a postgres connection string", async () => {
    await expect(loadWith({ DATABASE_URL: "mysql://localhost/db", NODE_ENV: "test" })).rejects.toThrow(/DATABASE_URL/)
  })
})

describe("env production guardrails", () => {
  it("boots when every required secret is present", async () => {
    const { env } = await loadWith(productionBase)

    expect(env.isProduction).toBe(true)
    expect(env.databaseUrl).toBeDefined()
  })

  it("refuses to boot in production without a database URL", async () => {
    await expect(loadWith({ ...productionBase, DATABASE_URL: undefined, SUPABASE_URL: productionBase.SUPABASE_URL })).rejects.toThrow(
      /DATABASE_URL/,
    )
  })

  it("refuses to boot in production without the Supabase service role key", async () => {
    await expect(loadWith({ ...productionBase, SUPABASE_SERVICE_ROLE_KEY: undefined })).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })

  it("requires the key matching the selected AI provider", async () => {
    await expect(
      loadWith({ ...productionBase, AI_PROVIDER: "openai", OPENAI_API_KEY: undefined }),
    ).rejects.toThrow(/OPENAI_API_KEY/)

    const { env } = await loadWith({ ...productionBase, AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-openai" })
    expect(env.aiProvider).toBe("openai")
  })

  it("accepts AI_API_KEY as a substitute for OPENAI_API_KEY", async () => {
    const { env } = await loadWith({ ...productionBase, AI_API_KEY: "sk-compatible", AI_PROVIDER: "openai" })

    expect(env.aiApiKey).toBe("sk-compatible")
  })

  it("only warns outside production, so local development still boots", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { env } = await loadWith({ NODE_ENV: "development" })

    expect(env.databaseUrl).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})
