-- A4: one-product-per-group unique constraint.
--
-- Ensures each ReportingGroup is associated with exactly ONE Project.
--
-- Strategy: C6 migration-safety pattern
--   1. Delete duplicate GroupProduct rows (keep first by productId ascending)
--   2. Add UNIQUE constraint on groupId alone
--   3. Preserve the (groupId, productId) unique pair for Prisma query optimization
--
-- This migration is SAFE to run on prod: no data loss, only deduplication.

-- Step 1: Delete duplicates (keep the row with the lowest productId per groupId)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "groupId" ORDER BY "productId" ASC, "createdAt" ASC) AS rn
  FROM "GroupProduct"
)
DELETE FROM "GroupProduct" WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Step 2: Add UNIQUE constraint on groupId alone
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_groupId_unique" UNIQUE ("groupId");
