-- R4-A: Add nullable productId FK to Decision and Priority.
--
-- Phase A of full product-scope binding. Introduces optional productId
-- column that links Decision and Priority to a specific Project (product).
-- Phase B (deferred) will make the columns NOT NULL once UI paths wire the
-- linkage during creation.
--
-- productId starts NULL for all existing rows. Phase B will add NOT NULL
-- after UI paths populate the column during Decision/Priority creation.

-- AlterTable Decision
ALTER TABLE "Decision" ADD COLUMN "productId" TEXT;

-- AlterTable Priority
ALTER TABLE "Priority" ADD COLUMN "productId" TEXT;

-- AddForeignKey Decision_productId
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Priority_productId
ALTER TABLE "Priority" ADD CONSTRAINT "Priority_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill deferred: ReportSection has no productId column.
-- Existing rows keep productId = NULL. Phase B (NOT NULL migration)
-- will require UI paths to wire productId during creation first.
