-- B1: flip GroupProduct uniqueness from groupId to productId.
-- A product belongs to exactly one reporting group (1:N inversion).
-- Drops the A4 constraint (@@unique([groupId])) and the composite
-- (@@unique([groupId, productId])), deduplicates by productId keeping the
-- earliest attachment, then adds UNIQUE on productId alone.

ALTER TABLE "GroupProduct"
  DROP CONSTRAINT IF EXISTS "GroupProduct_groupId_unique";

ALTER TABLE "GroupProduct"
  DROP CONSTRAINT IF EXISTS "GroupProduct_groupId_productId_key";

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
