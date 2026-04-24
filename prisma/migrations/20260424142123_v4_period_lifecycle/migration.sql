-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('open', 'published', 'reopened');

-- AlterTable
ALTER TABLE "ReminderRule" ALTER COLUMN "kind" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "periodStatus" "PeriodStatus" NOT NULL DEFAULT 'open',
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "weekLabel" TEXT;

-- AlterTable
ALTER TABLE "ReportSection" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedBy" TEXT;

-- CreateTable
CREATE TABLE "VersionSnapshot" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "departmentName" TEXT NOT NULL DEFAULT 'Development',
    "autoCreatePeriods" BOOLEAN NOT NULL DEFAULT false,
    "defaultDeadlineDays" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VersionSnapshot_reportSectionId_version_idx" ON "VersionSnapshot"("reportSectionId", "version" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "VersionSnapshot_reportSectionId_version_key" ON "VersionSnapshot"("reportSectionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_name_key" ON "Stage"("name");

-- CreateIndex
CREATE INDEX "StageAssignment_projectId_idx" ON "StageAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StageAssignment_userId_stageId_projectId_key" ON "StageAssignment"("userId", "stageId", "projectId");

-- AddForeignKey
ALTER TABLE "VersionSnapshot" ADD CONSTRAINT "VersionSnapshot_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
