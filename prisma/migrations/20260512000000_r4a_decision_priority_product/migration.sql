-- R4-A: Add nullable productId FK to Decision and Priority.
--
-- Phase A of full product-scope binding. Introduces optional productId
-- column that links Decision and Priority to a specific Project (product).
-- Phase B (deferred) will make the columns NOT NULL once UI paths wire the
-- linkage during creation.
--
-- Backfill copies productId from linked ReportSection if available. If
-- ReportSection.productId does not exist yet, the UPDATE affects 0 rows
-- (safe).

-- AlterTable Decision
ALTER TABLE "Decision" ADD COLUMN "productId" TEXT;

-- AlterTable Priority
ALTER TABLE "Priority" ADD COLUMN "productId" TEXT;

-- AddForeignKey Decision_productId
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Priority_productId
ALTER TABLE "Priority" ADD CONSTRAINT "Priority_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill productId from linked ReportSection (if it exists).
-- This is safe even if ReportSection.productId doesn't exist yet;
-- the UPDATE will affect 0 rows.
UPDATE "Decision" d
SET "productId" = s."productId"
FROM "ReportSection" s
WHERE d."reportSectionId" = s.id
  AND s."productId" IS NOT NULL;

UPDATE "Priority" p
SET "productId" = s."productId"
FROM "ReportSection" s
WHERE p."reportSectionId" = s.id
  AND s."productId" IS NOT NULL;
