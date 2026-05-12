-- R4-C: Make Decision.productId and Priority.productId NOT NULL.
--
-- Phase A (R4-A) added nullable productId FKs. Phase B (R4-B) wired
-- the UI to populate productId on every new Decision/Priority. This
-- Phase C enforces the constraint at the DB level.
--
-- Strategy:
--   1. Remove orphaned rows (productId IS NULL = created before R4-B UI
--      wire-up; UAT-safe since all data is wiped on each test cycle).
--   2. Alter column to NOT NULL.
--   3. Swap FK constraint: SET NULL → CASCADE (because NOT NULL and
--      SET NULL are mutually exclusive; cascade-on-product-delete is
--      the expected semantic for product-scoped artefacts).

-- Step 1: drop rows that have no product scope (pre-R4-B data)
DELETE FROM "Decision"  WHERE "productId" IS NULL;
DELETE FROM "Priority"  WHERE "productId" IS NULL;

-- Step 2: enforce NOT NULL
ALTER TABLE "Decision" ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE "Priority" ALTER COLUMN "productId" SET NOT NULL;

-- Step 3: swap FK constraints (SET NULL → CASCADE)
ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_productId_fkey";
ALTER TABLE "Decision"
  ADD CONSTRAINT "Decision_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Priority" DROP CONSTRAINT IF EXISTS "Priority_productId_fkey";
ALTER TABLE "Priority"
  ADD CONSTRAINT "Priority_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
