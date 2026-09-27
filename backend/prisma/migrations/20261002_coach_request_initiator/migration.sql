-- Record who opened each coach request, so only the other side can accept it.
-- Existing rows were trainee requests: a coach's invite could not be accepted
-- by the trainee before this change.
CREATE TYPE "CoachRequestInitiator" AS ENUM ('trainee', 'coach');

ALTER TABLE "CoachRequest"
  ADD COLUMN "initiatedBy" "CoachRequestInitiator" NOT NULL DEFAULT 'trainee';

-- DOWN (manual):
--   ALTER TABLE "CoachRequest" DROP COLUMN "initiatedBy";
--   DROP TYPE "CoachRequestInitiator";
