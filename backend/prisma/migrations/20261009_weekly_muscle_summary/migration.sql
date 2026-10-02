-- Completed weeks of training per trainee and muscle, kept so the volume
-- engine can learn each trainee's own MEV/MAV/MRV from months of history
-- without re-reading every workout snapshot. A background job rewrites a week's
-- rows whenever it recomputes that week.
CREATE TABLE "WeeklyMuscleSummary" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "muscleSlug" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "directSets" INTEGER NOT NULL,
    "indirectSets" INTEGER NOT NULL,
    "effectiveSets" DOUBLE PRECISION NOT NULL,
    "lowConfidenceSets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageRir" DOUBLE PRECISION,
    "performanceChangePct" DOUBLE PRECISION,
    "averageReadiness" DOUBLE PRECISION,
    "maxSoreness" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMuscleSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyMuscleSummary_userId_muscleSlug_weekStart_key"
    ON "WeeklyMuscleSummary"("userId", "muscleSlug", "weekStart");
CREATE INDEX "WeeklyMuscleSummary_userId_weekStart_idx" ON "WeeklyMuscleSummary"("userId", "weekStart");
CREATE INDEX "WeeklyMuscleSummary_muscleSlug_idx" ON "WeeklyMuscleSummary"("muscleSlug");

ALTER TABLE "WeeklyMuscleSummary" ADD CONSTRAINT "WeeklyMuscleSummary_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyMuscleSummary" ADD CONSTRAINT "WeeklyMuscleSummary_muscleSlug_fkey"
    FOREIGN KEY ("muscleSlug") REFERENCES "MuscleRegion"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Read and written by the backend (service role) only; keep it off the Data API.
ALTER TABLE "WeeklyMuscleSummary" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "WeeklyMuscleSummary" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "WeeklyMuscleSummary" FROM authenticated;
  END IF;
END $$;

-- DOWN (manual):
--   DROP TABLE "WeeklyMuscleSummary";
