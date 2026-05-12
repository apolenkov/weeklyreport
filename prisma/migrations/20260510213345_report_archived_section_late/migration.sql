-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReportSection" ADD COLUMN     "late" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Report_archived_periodStart_idx" ON "Report"("archived", "periodStart" DESC);
