-- B1: flip GroupProduct uniqueness from groupId to productId.
-- A product belongs to exactly one reporting group (1:N inversion).
-- Drops the A4 constraint (@@unique([groupId])) and the composite
-- unique INDEX created by the M2M migration (not a CONSTRAINT — it was
-- created via CREATE UNIQUE INDEX, so DROP INDEX is required, not
-- DROP CONSTRAINT), then deduplicates by productId keeping the earliest
-- attachment, and adds a UNIQUE CONSTRAINT on productId alone.

-- A4 added this as ADD CONSTRAINT, so DROP CONSTRAINT is correct here.
ALTER TABLE "GroupProduct"
  DROP CONSTRAINT IF EXISTS "GroupProduct_groupId_unique";

-- M2M migration used CREATE UNIQUE INDEX (not ADD CONSTRAINT), so this
-- must be dropped as an index, not a constraint. DROP CONSTRAINT IF EXISTS
-- would silently no-op, leaving the stale index in place.
DROP INDEX IF EXISTS "GroupProduct_groupId_productId_key";

-- Dedupe by productId. Keep the earliest attachment (lowest createdAt).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "productId"
           ORDER BY "createdAt" ASC, "groupId" ASC
         ) AS rn
  FROM "GroupProduct"
)
DELETE FROM "GroupProduct"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE "GroupProduct"
  ADD CONSTRAINT "GroupProduct_productId_key" UNIQUE ("productId");
