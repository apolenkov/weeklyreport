-- UFB-054 / Phase 56-A: explicit Group ↔ Product M:M edge.
--
-- Today products belong to a group implicitly through `Project.lead.reportingGroupId`.
-- This migration introduces an explicit join table so:
--   - a product can belong to multiple groups (cross-departmental);
--   - lead rotation does not change product ownership at the group level;
--   - head dashboards can read «my group's products» without joining through User.
--
-- The backfill seeds one row per existing Project mapping to the lead's
-- ReportingGroup. ON CONFLICT DO NOTHING makes the backfill idempotent so the
-- migration is safe to re-run against a partially-migrated database.
--
-- Existing scope-filter callers (Phase 46 group-scope helper) continue to
-- derive group from `Project.lead.reportingGroupId` until they opt in via the
-- Phase 56-D `useExplicitGroupProducts` flag.

-- CreateTable
CREATE TABLE "GroupProduct" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupProduct_groupId_productId_key" ON "GroupProduct"("groupId", "productId");

-- CreateIndex
CREATE INDEX "GroupProduct_groupId_idx" ON "GroupProduct"("groupId");

-- CreateIndex
CREATE INDEX "GroupProduct_productId_idx" ON "GroupProduct"("productId");

-- AddForeignKey
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReportingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- UFB-054 / Phase 56-A backfill
-- ---------------------------------------------------------------------------
-- Seed one GroupProduct row per existing Project mapping to its lead's group.
-- `User.reportingGroupId` is non-nullable in the current schema; the explicit
-- IS NOT NULL guard is defensive against future schema changes that may
-- relax that constraint. ON CONFLICT DO NOTHING makes the backfill idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO "GroupProduct" (id, "groupId", "productId", "createdAt")
SELECT gen_random_uuid(), u."reportingGroupId", p.id, NOW()
FROM "Project" p
JOIN "User" u ON u.id = p."leadId"
WHERE u."reportingGroupId" IS NOT NULL
ON CONFLICT ("groupId", "productId") DO NOTHING;
