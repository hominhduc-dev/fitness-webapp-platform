-- Additive migration: existing user and application data remain unchanged.
CREATE TABLE "public"."UserFeedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pagePath" TEXT,
    "appVersion" TEXT,
    "userAgent" TEXT,
    "screenshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserFeedback_category_check" CHECK ("category" IN ('bug', 'suggestion')),
    CONSTRAINT "UserFeedback_status_check" CHECK ("status" IN ('new', 'in_progress', 'resolved'))
);

CREATE INDEX "UserFeedback_userId_createdAt_idx" ON "public"."UserFeedback"("userId", "createdAt");
CREATE INDEX "UserFeedback_status_createdAt_idx" ON "public"."UserFeedback"("status", "createdAt");

ALTER TABLE "public"."UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No Data API policies: only the privileged Prisma backend may access submissions.
ALTER TABLE "public"."UserFeedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."UserFeedback" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "public"."UserFeedback" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "public"."UserFeedback" FROM authenticated;
  END IF;
END $$;
