-- Per-coach Google account link, used to read program templates from their Sheets.
--
-- One row per user: reconnecting replaces the row rather than accumulating stale
-- grants, which is why userId carries a UNIQUE constraint rather than a plain index.
--
-- Both token columns hold AES-256-GCM ciphertext produced by the application, never
-- a raw token. The encryption key lives in GOOGLE_TOKEN_ENCRYPTION_KEY, outside the
-- database, so a database dump on its own does not expose anyone's Google account.

CREATE TABLE "GoogleConnection" (
  "id"                    UUID NOT NULL,
  "userId"                UUID NOT NULL,
  "googleEmail"           TEXT,
  "accessTokenEncrypted"  TEXT NOT NULL,
  -- Google returns a refresh token only on the first consent, so this stays
  -- nullable; a null means the grant dies with the current access token.
  "refreshTokenEncrypted" TEXT,
  "expiresAt"             TIMESTAMP(3) NOT NULL,
  "scope"                 TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleConnection_userId_key" ON "GoogleConnection" ("userId");

-- Supports the sweep that refreshes tokens before they expire.
CREATE INDEX "GoogleConnection_expiresAt_idx" ON "GoogleConnection" ("expiresAt");

-- Deleting a user must revoke their stored grant, never orphan it.
ALTER TABLE "GoogleConnection"
  ADD CONSTRAINT "GoogleConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN (manual rollback):
--   ALTER TABLE "GoogleConnection" DROP CONSTRAINT "GoogleConnection_userId_fkey";
--   DROP INDEX "GoogleConnection_expiresAt_idx";
--   DROP INDEX "GoogleConnection_userId_key";
--   DROP TABLE "GoogleConnection";
