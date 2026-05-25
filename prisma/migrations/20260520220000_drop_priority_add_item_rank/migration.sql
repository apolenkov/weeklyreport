-- F1: Priorities refactor — move priority rank onto Item, drop Priority table.
--
-- Priority was a separate entity linked to reportSection + product.
-- After this migration, `Item.priorityRank Int?` carries the rank directly.
-- Cross-author aggregation works for free via Item.projectId.

ALTER TABLE "Item"
  ADD COLUMN "priorityRank" INTEGER;

-- Partial index: only index rows that have a priority rank set.
CREATE INDEX "Item_section_priority_idx"
  ON "Item"("reportSectionId", "priorityRank")
  WHERE "priorityRank" IS NOT NULL;

-- Drop the compound index that Prisma will regenerate (prisma generates a
-- different name; the partial index above replaces it for priority queries).
DROP TABLE "Priority";
