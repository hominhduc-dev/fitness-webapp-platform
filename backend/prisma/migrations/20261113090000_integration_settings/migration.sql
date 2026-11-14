-- Admin-managed external API settings (AI provider, model, API key).
-- Additive: when no row exists the backend keeps using environment variables.
-- The API key is stored only as AES-256-GCM ciphertext (GOOGLE_TOKEN_ENCRYPTION_KEY);
-- secretHint holds the last 4 characters for display.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "public"."IntegrationSetting" (
    "key" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "secretCiphertext" TEXT,
    "secretHint" TEXT,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("key")
);

-- No Data API policies: only the privileged Prisma backend may read API secrets.
ALTER TABLE "public"."IntegrationSetting" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."IntegrationSetting" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "public"."IntegrationSetting" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "public"."IntegrationSetting" FROM authenticated;
  END IF;
END $$;

COMMIT;

-- DOWN (manual): DROP TABLE IF EXISTS "public"."IntegrationSetting";
