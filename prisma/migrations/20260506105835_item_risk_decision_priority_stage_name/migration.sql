-- 35-04: Add nullable `stageName` column + index to Item, Risk, Decision,
-- Priority. Nullable for back-compat with rows seeded before this column
-- existed; the lead-form modals enforce required client-side. Indexes are
-- cheap (small NDV — at most 7 distinct values per row) and improve filter
-- queries that scope by SDLC stage on the report card.

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "stageName" TEXT;

-- AlterTable
ALTER TABLE "Risk" ADD COLUMN "stageName" TEXT;

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN "stageName" TEXT;

-- AlterTable
ALTER TABLE "Priority" ADD COLUMN "stageName" TEXT;

-- CreateIndex
CREATE INDEX "Item_stageName_idx" ON "Item"("stageName");

-- CreateIndex
CREATE INDEX "Risk_stageName_idx" ON "Risk"("stageName");

-- CreateIndex
CREATE INDEX "Decision_stageName_idx" ON "Decision"("stageName");

-- CreateIndex
CREATE INDEX "Priority_stageName_idx" ON "Priority"("stageName");
