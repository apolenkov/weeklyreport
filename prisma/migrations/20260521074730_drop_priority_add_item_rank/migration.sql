-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_reportingGroupId_fkey";

-- CreateIndex
CREATE INDEX "Decision_productId_idx" ON "Decision"("productId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reportingGroupId_fkey" FOREIGN KEY ("reportingGroupId") REFERENCES "ReportingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Item_section_priority_idx" RENAME TO "Item_reportSectionId_priorityRank_idx";
