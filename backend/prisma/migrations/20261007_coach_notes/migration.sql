-- Notes a coach keeps about one of their trainees, shown on the trainee's page.
-- Only the coach who wrote a note sees it.
CREATE TABLE "CoachNote" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "traineeId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachNote_body_length" CHECK (char_length("body") BETWEEN 1 AND 2000)
);

CREATE INDEX "CoachNote_traineeId_coachId_createdAt_idx" ON "CoachNote"("traineeId", "coachId", "createdAt");
CREATE INDEX "CoachNote_coachId_idx" ON "CoachNote"("coachId");

ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_traineeId_fkey"
    FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase exposes the public schema over its Data API; this table is read
-- only by the backend (service role), so lock it to everyone else.
ALTER TABLE "CoachNote" ENABLE ROW LEVEL SECURITY;

-- DOWN (manual):
--   DROP TABLE "CoachNote";
