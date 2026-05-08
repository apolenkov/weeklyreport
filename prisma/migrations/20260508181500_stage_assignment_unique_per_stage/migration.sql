-- Ensure each product stage has a single assignee. Older data could contain
-- one row per user for the same product/stage, which made Admin changes appear
-- to save while the UI kept reading the older assignment.
DELETE FROM "StageAssignment" sa
USING "StageAssignment" newer
WHERE sa."stageId" = newer."stageId"
  AND sa."projectId" = newer."projectId"
  AND (
    sa."createdAt" < newer."createdAt"
    OR (sa."createdAt" = newer."createdAt" AND sa."id" < newer."id")
  );

DROP INDEX IF EXISTS "StageAssignment_userId_stageId_projectId_key";

CREATE UNIQUE INDEX "StageAssignment_stageId_projectId_key"
  ON "StageAssignment"("stageId", "projectId");
