-- CreateEnum
CREATE TYPE "Role" AS ENUM ('lead', 'head', 'viewer');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "ReportSectionStatus" AS ENUM ('draft', 'submitted');

-- CreateEnum
CREATE TYPE "TrafficLightStatus" AS ENUM ('green', 'yellow', 'red');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('current', 'next');

-- CreateEnum
CREATE TYPE "ItemWorkflowStatus" AS ENUM ('done', 'in_progress', 'blocked');

-- CreateEnum
CREATE TYPE "PdfExportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ReminderExecutionStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "CarryOverStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "samlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "ReportSectionStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "TrafficLightStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "text" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "workflowStatus" "ItemWorkflowStatus" NOT NULL,
    "carriedOver" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "impact" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Priority" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfExportJob" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "PdfExportStatus" NOT NULL DEFAULT 'pending',
    "filePath" TEXT,
    "error" TEXT,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "ReminderExecutionStatus" NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarryOverExecution" (
    "id" TEXT NOT NULL,
    "sourceReportId" TEXT NOT NULL,
    "targetReportId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "CarryOverStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarryOverExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarryOverRecord" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "sourceDecisionId" TEXT,
    "targetItemId" TEXT,
    "targetDecisionId" TEXT,
    "recordType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarryOverRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_samlId_key" ON "User"("samlId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSection_reportId_authorId_key" ON "ReportSection"("reportId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_reportSectionId_projectId_key" ON "ProjectStatus"("reportSectionId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Priority_reportSectionId_rank_key" ON "Priority"("reportSectionId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderExecution_dedupeKey_key" ON "ReminderExecution"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "CarryOverExecution_dedupeKey_key" ON "CarryOverExecution"("dedupeKey");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Priority" ADD CONSTRAINT "Priority_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfExportJob" ADD CONSTRAINT "PdfExportJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderExecution" ADD CONSTRAINT "ReminderExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverExecution" ADD CONSTRAINT "CarryOverExecution_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverExecution" ADD CONSTRAINT "CarryOverExecution_targetReportId_fkey" FOREIGN KEY ("targetReportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverRecord" ADD CONSTRAINT "CarryOverRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "CarryOverExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
