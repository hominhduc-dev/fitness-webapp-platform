-- Notices an admin sends to every active trainee and coach. Each recipient's
-- copy is a Notification pointing back here (relatedEntityType 'admin_broadcast').
CREATE TABLE "AdminBroadcast" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminBroadcast_createdAt_idx" ON "AdminBroadcast"("createdAt");

ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase exposes the public schema over its Data API; this table is read
-- only by the backend (service role), so lock it to everyone else.
ALTER TABLE "AdminBroadcast" ENABLE ROW LEVEL SECURITY;

-- DOWN (manual):
--   DROP TABLE "AdminBroadcast";
