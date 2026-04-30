-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN     "reportId" TEXT;

-- CreateIndex
CREATE INDEX "AiInsight_reportId_createdAt_idx" ON "AiInsight"("reportId", "createdAt");
