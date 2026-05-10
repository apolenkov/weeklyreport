-- AlterTable
ALTER TABLE "ReportingGroup" ADD COLUMN     "headUserId" TEXT;

-- CreateTable
CREATE TABLE "ViewerGroupAccess" (
    "id" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerGroupAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ViewerGroupAccess_viewerUserId_idx" ON "ViewerGroupAccess"("viewerUserId");

-- CreateIndex
CREATE INDEX "ViewerGroupAccess_groupId_idx" ON "ViewerGroupAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerGroupAccess_viewerUserId_groupId_key" ON "ViewerGroupAccess"("viewerUserId", "groupId");

-- CreateIndex
CREATE INDEX "ReportingGroup_headUserId_idx" ON "ReportingGroup"("headUserId");

-- AddForeignKey
ALTER TABLE "ReportingGroup" ADD CONSTRAINT "ReportingGroup_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupAccess" ADD CONSTRAINT "ViewerGroupAccess_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupAccess" ADD CONSTRAINT "ViewerGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReportingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UFB-039 backfill: every existing group gets a headUserId set to the first
-- head user that already belongs to that group. Groups with zero head members
-- stay NULL (admin still has to assign one from the UI).
UPDATE "ReportingGroup" g
SET    "headUserId" = u.id
FROM   "User" u
WHERE  u."reportingGroupId" = g.id
  AND  u.role = 'head'
  AND  g."headUserId" IS NULL
  AND  u.id = (
    SELECT u2.id
    FROM   "User" u2
    WHERE  u2."reportingGroupId" = g.id
      AND  u2.role = 'head'
    ORDER  BY u2."createdAt" ASC
    LIMIT  1
  );
