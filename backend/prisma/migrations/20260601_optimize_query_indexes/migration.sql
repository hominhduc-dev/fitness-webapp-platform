-- Optimize hot query paths by replacing single-column indexes with composite
-- indexes that match the actual WHERE + ORDER BY shapes used in the services.
--
-- WorkoutLog: history/calendar/analytics all filter by userId and range/sort on
-- startedAt. The composite index serves "WHERE userId = ? [AND startedAt ...]
-- ORDER BY startedAt" without a separate sort, and its userId prefix still
-- serves plain userId equality lookups (so dropping userId-only is safe).
DROP INDEX "WorkoutLog_userId_idx";
CREATE INDEX "WorkoutLog_userId_startedAt_idx" ON "WorkoutLog"("userId", "startedAt");

-- CoachRequest: the coach dashboard lists pending requests via
-- "WHERE coachId = ? AND status = 'pending'". The composite index covers that
-- and its coachId prefix still serves coachId-only lookups.
DROP INDEX "CoachRequest_coachId_idx";
CREATE INDEX "CoachRequest_coachId_status_idx" ON "CoachRequest"("coachId", "status");

-- DOWN (manual rollback):
--   DROP INDEX "WorkoutLog_userId_startedAt_idx";
--   CREATE INDEX "WorkoutLog_userId_idx" ON "WorkoutLog"("userId");
--   DROP INDEX "CoachRequest_coachId_status_idx";
--   CREATE INDEX "CoachRequest_coachId_idx" ON "CoachRequest"("coachId");
