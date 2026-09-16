-- Coaches can now sign themselves up from /coach-signup. A new coach account is
-- created locked (isActive = false) and waits here as 'pending' until an admin
-- approves or rejects it. Only coach rows carry a status; trainees and admins
-- keep NULL. Coaches that already exist were created by an admin, so they are
-- backfilled as approved.

CREATE TYPE "CoachApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "coachApprovalStatus" "CoachApprovalStatus",
ADD COLUMN IF NOT EXISTS "coachApprovalDecidedAt" TIMESTAMP(3);

UPDATE "User"
SET "coachApprovalStatus" = 'approved'
WHERE "role" = 'coach' AND "coachApprovalStatus" IS NULL;

-- Serves the admin queue, which reads pending coaches by role + status.
CREATE INDEX IF NOT EXISTS "User_role_coachApprovalStatus_idx"
ON "User"("role", "coachApprovalStatus");

-- DOWN (manual rollback):
--   DROP INDEX IF EXISTS "User_role_coachApprovalStatus_idx";
--   ALTER TABLE "User" DROP COLUMN IF EXISTS "coachApprovalDecidedAt";
--   ALTER TABLE "User" DROP COLUMN IF EXISTS "coachApprovalStatus";
--   DROP TYPE IF EXISTS "CoachApprovalStatus";
