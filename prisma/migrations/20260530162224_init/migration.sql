-- CreateEnum
CREATE TYPE "Role" AS ENUM ('lead', 'head', 'viewer', 'admin');

-- CreateEnum
CREATE TYPE "UserActionStatus" AS ENUM ('success', 'fail');

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
CREATE TYPE "PdfExportStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ReminderExecutionStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "CarryOverStatus" AS ENUM ('completed');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('open', 'published', 'reopened');

-- CreateEnum
CREATE TYPE "PeriodState" AS ENUM ('scheduled', 'open', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ReopenRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ReminderRuleKind" AS ENUM ('deadline', 'follow_up', 'escalation');

-- CreateEnum
CREATE TYPE "ReminderAudience" AS ENUM ('LEAD_WITH_DRAFT', 'HEAD_OF_LATE');

-- CreateEnum
CREATE TYPE "WorkingDays" AS ENUM ('MON_FRI', 'MON_SAT', 'MON_SUN');

-- CreateEnum
CREATE TYPE "ReminderRuleStatus" AS ENUM ('active', 'paused');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "position" TEXT,
    "role" "Role" NOT NULL,
    "samlId" TEXT NOT NULL,
    "reportingGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notificationOptOut" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "headUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerGroupAccess" (
    "id" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerGroupAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role",
    "procedure" TEXT NOT NULL,
    "targetId" TEXT,
    "status" "UserActionStatus" NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "correlationId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS (to_tsvector('russian'::regconfig, COALESCE(name, ''::text))) STORED,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupProduct" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupProduct_pkey" PRIMARY KEY ("id")
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
    "periodStatus" "PeriodStatus" NOT NULL DEFAULT 'open',
    "reopenedAt" TIMESTAMP(3),
    "weekLabel" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "autoPublished" BOOLEAN NOT NULL DEFAULT false,
    "autoArchived" BOOLEAN NOT NULL DEFAULT false,
    "periodState" "PeriodState" NOT NULL DEFAULT 'open',
    "publishedSnapshot" JSONB,

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
    "version" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "late" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "TrafficLightStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageStatus" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "TrafficLightStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "text" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "workflowStatus" "ItemWorkflowStatus" NOT NULL,
    "carriedOver" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN,
    "priorityRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS (to_tsvector('russian'::regconfig, COALESCE(text, ''::text))) STORED,
    "stageNames" TEXT[],

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'at-risk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS (to_tsvector('russian'::regconfig, ((((COALESCE(risk, ''::text) || ' '::text) || COALESCE(impact, ''::text)) || ' '::text) || COALESCE(mitigation, ''::text)))) STORED,
    "stageNames" TEXT[],

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "impact" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS (to_tsvector('russian'::regconfig, COALESCE(text, ''::text))) STORED,
    "stageNames" TEXT[],

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
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
    "reportId" TEXT,
    "policyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "ReminderRuleKind" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "status" "ReminderRuleStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderPolicy" (
    "id" TEXT NOT NULL,
    "kind" "ReminderRuleKind" NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "audience" "ReminderAudience" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderPolicy_pkey" PRIMARY KEY ("id")
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
    "status" "CarryOverStatus" NOT NULL DEFAULT 'completed',
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
CREATE TABLE "ReopenRequest" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReopenRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReopenRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "autoCreatePeriods" BOOLEAN NOT NULL DEFAULT false,
    "defaultDeadlineDays" INTEGER NOT NULL DEFAULT 5,
    "periodLengthDays" INTEGER NOT NULL DEFAULT 7,
    "workingDays" "WorkingDays" NOT NULL DEFAULT 'MON_FRI',
    "gracePeriodHours" INTEGER NOT NULL DEFAULT 24,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "defaultReminderAudience" "ReminderAudience" NOT NULL DEFAULT 'LEAD_WITH_DRAFT',
    "notificationFromEmail" TEXT,
    "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true,
    "autoPublishAfterDeadline" BOOLEAN NOT NULL DEFAULT false,
    "autoArchiveWeeksAfterPublish" INTEGER NOT NULL DEFAULT 0,
    "deadlineTime" TEXT NOT NULL DEFAULT '18:00',
    "allowReopenAfterPublish" BOOLEAN NOT NULL DEFAULT true,
    "reopenWindowHours" INTEGER NOT NULL DEFAULT 72,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "shortName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "TelegramBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_samlId_key" ON "User"("samlId");

-- CreateIndex
CREATE INDEX "User_reportingGroupId_idx" ON "User"("reportingGroupId");

-- CreateIndex
CREATE INDEX "ReportingGroup_archived_idx" ON "ReportingGroup"("archived");

-- CreateIndex
CREATE INDEX "ReportingGroup_headUserId_idx" ON "ReportingGroup"("headUserId");

-- CreateIndex
CREATE INDEX "ViewerGroupAccess_viewerUserId_idx" ON "ViewerGroupAccess"("viewerUserId");

-- CreateIndex
CREATE INDEX "ViewerGroupAccess_groupId_idx" ON "ViewerGroupAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerGroupAccess_viewerUserId_groupId_key" ON "ViewerGroupAccess"("viewerUserId", "groupId");

-- CreateIndex
CREATE INDEX "UserActionLog_userId_createdAt_idx" ON "UserActionLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserActionLog_procedure_createdAt_idx" ON "UserActionLog"("procedure", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserActionLog_correlationId_idx" ON "UserActionLog"("correlationId");

-- CreateIndex
CREATE INDEX "UserActionLog_createdAt_idx" ON "UserActionLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Project_leadId_idx" ON "Project"("leadId");

-- CreateIndex
CREATE INDEX "Project_archived_idx" ON "Project"("archived");

-- CreateIndex
CREATE INDEX "Project_searchTsv_idx" ON "Project" USING GIN ("searchTsv");

-- CreateIndex
CREATE INDEX "GroupProduct_groupId_idx" ON "GroupProduct"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupProduct_productId_key" ON "GroupProduct"("productId");

-- CreateIndex
CREATE INDEX "Report_periodStart_idx" ON "Report"("periodStart" DESC);

-- CreateIndex
CREATE INDEX "Report_status_periodStart_idx" ON "Report"("status", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "Report_archived_periodStart_idx" ON "Report"("archived", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "Report_periodState_periodStart_idx" ON "Report"("periodState", "periodStart" DESC);

-- period-dual-state (C2 / A24/A21): at most ONE open Report per reporting
-- boundary. Prisma cannot express a partial unique index (the WHERE predicate),
-- so it is hand-written here (mirrors ReopenRequest_one_pending_per_section).
-- Published/archived rows for the same boundary are unconstrained. This is the
-- durable guarantee behind the period factory's concurrent-create race guard:
-- two simultaneous lead logins (or a login racing the period-creator cron) both
-- pass the find step, one create wins, the other gets P2002 and re-reads.
CREATE UNIQUE INDEX "Report_one_open_per_boundary"
  ON "Report"("periodStart", "periodEnd")
  WHERE "periodState" = 'open';

-- CreateIndex
CREATE INDEX "ReportSection_authorId_idx" ON "ReportSection"("authorId");

-- CreateIndex
CREATE INDEX "ReportSection_status_idx" ON "ReportSection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSection_reportId_authorId_key" ON "ReportSection"("reportId", "authorId");

-- CreateIndex
CREATE INDEX "ProjectStatus_projectId_idx" ON "ProjectStatus"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_reportSectionId_projectId_key" ON "ProjectStatus"("reportSectionId", "projectId");

-- CreateIndex
CREATE INDEX "StageStatus_projectId_idx" ON "StageStatus"("projectId");

-- CreateIndex
CREATE INDEX "StageStatus_stageId_idx" ON "StageStatus"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "StageStatus_reportSectionId_projectId_stageId_key" ON "StageStatus"("reportSectionId", "projectId", "stageId");

-- CreateIndex
CREATE INDEX "Item_reportSectionId_idx" ON "Item"("reportSectionId");

-- CreateIndex
CREATE INDEX "Item_projectId_idx" ON "Item"("projectId");

-- CreateIndex
CREATE INDEX "Item_reportSectionId_priorityRank_idx" ON "Item"("reportSectionId", "priorityRank");

-- CreateIndex
CREATE INDEX "Item_searchTsv_idx" ON "Item" USING GIN ("searchTsv");

-- CreateIndex
CREATE UNIQUE INDEX "Item_reportSectionId_stableId_key" ON "Item"("reportSectionId", "stableId");

-- CreateIndex
CREATE INDEX "Item_stableId_idx" ON "Item"("stableId");

-- CreateIndex
CREATE INDEX "Risk_reportSectionId_idx" ON "Risk"("reportSectionId");

-- CreateIndex
CREATE INDEX "Risk_projectId_idx" ON "Risk"("projectId");

-- CreateIndex
CREATE INDEX "Risk_searchTsv_idx" ON "Risk" USING GIN ("searchTsv");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_reportSectionId_stableId_key" ON "Risk"("reportSectionId", "stableId");

-- CreateIndex
CREATE INDEX "Risk_stableId_idx" ON "Risk"("stableId");

-- CreateIndex
CREATE INDEX "Decision_reportSectionId_idx" ON "Decision"("reportSectionId");

-- CreateIndex
CREATE INDEX "Decision_productId_idx" ON "Decision"("productId");

-- CreateIndex
CREATE INDEX "Decision_searchTsv_idx" ON "Decision" USING GIN ("searchTsv");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_reportSectionId_stableId_key" ON "Decision"("reportSectionId", "stableId");

-- CreateIndex
CREATE INDEX "Decision_stableId_idx" ON "Decision"("stableId");

-- CreateIndex
CREATE INDEX "PdfExportJob_reportId_idx" ON "PdfExportJob"("reportId");

-- CreateIndex
CREATE INDEX "PdfExportJob_requestedBy_idx" ON "PdfExportJob"("requestedBy");

-- CreateIndex
CREATE INDEX "PdfExportJob_status_createdAt_idx" ON "PdfExportJob"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderRule_createdAt_idx" ON "ReminderRule"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderRule_status_fireAt_idx" ON "ReminderRule"("status", "fireAt");

-- CreateIndex
CREATE INDEX "ReminderRule_policyId_idx" ON "ReminderRule"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rule_report_policy" ON "ReminderRule"("reportId", "policyId");

-- CreateIndex
CREATE INDEX "ReminderPolicy_kind_active_idx" ON "ReminderPolicy"("kind", "active");

-- CreateIndex
CREATE INDEX "ReminderPolicy_active_idx" ON "ReminderPolicy"("active");

-- CreateIndex
CREATE INDEX "ReminderPolicy_validFrom_validUntil_idx" ON "ReminderPolicy"("validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderExecution_dedupeKey_key" ON "ReminderExecution"("dedupeKey");

-- CreateIndex
CREATE INDEX "ReminderExecution_createdAt_idx" ON "ReminderExecution"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderExecution_ruleId_idx" ON "ReminderExecution"("ruleId");

-- CreateIndex
CREATE INDEX "ReminderExecution_status_idx" ON "ReminderExecution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CarryOverExecution_dedupeKey_key" ON "CarryOverExecution"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_name_key" ON "Stage"("name");

-- CreateIndex
CREATE INDEX "StageAssignment_userId_idx" ON "StageAssignment"("userId");

-- CreateIndex
CREATE INDEX "StageAssignment_projectId_idx" ON "StageAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StageAssignment_stageId_projectId_key" ON "StageAssignment"("stageId", "projectId");

-- CreateIndex
CREATE INDEX "ReopenRequest_status_createdAt_idx" ON "ReopenRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReopenRequest_reportSectionId_idx" ON "ReopenRequest"("reportSectionId");

-- CreateIndex
CREATE INDEX "ReopenRequest_requestedById_idx" ON "ReopenRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ReopenRequest_reviewedById_idx" ON "ReopenRequest"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBinding_userId_key" ON "TelegramBinding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBinding_chatId_key" ON "TelegramBinding"("chatId");

-- CreateIndex
CREATE INDEX "TelegramBinding_active_linkedAt_idx" ON "TelegramBinding"("active", "linkedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reportingGroupId_fkey" FOREIGN KEY ("reportingGroupId") REFERENCES "ReportingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingGroup" ADD CONSTRAINT "ReportingGroup_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupAccess" ADD CONSTRAINT "ViewerGroupAccess_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupAccess" ADD CONSTRAINT "ViewerGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReportingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReportingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageStatus" ADD CONSTRAINT "StageStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageStatus" ADD CONSTRAINT "StageStatus_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageStatus" ADD CONSTRAINT "StageStatus_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfExportJob" ADD CONSTRAINT "PdfExportJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ReminderPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderExecution" ADD CONSTRAINT "ReminderExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverExecution" ADD CONSTRAINT "CarryOverExecution_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverExecution" ADD CONSTRAINT "CarryOverExecution_targetReportId_fkey" FOREIGN KEY ("targetReportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarryOverRecord" ADD CONSTRAINT "CarryOverRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "CarryOverExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssignment" ADD CONSTRAINT "StageAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReopenRequest" ADD CONSTRAINT "ReopenRequest_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReopenRequest" ADD CONSTRAINT "ReopenRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReopenRequest" ADD CONSTRAINT "ReopenRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramBinding" ADD CONSTRAINT "TelegramBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the Risk.severity domain guard from 20260515141000_risk_severity.
-- Prisma cannot express CHECK constraints in schema.prisma, so it is restated
-- here to keep the squashed init faithful to the original migration history.
ALTER TABLE "Risk"
  ADD CONSTRAINT "Risk_severity_check"
  CHECK ("severity" IN ('at-risk', 'blocked'));

-- reopen-request-lifecycle (D5): at most ONE pending reopen request per
-- section. Prisma cannot express a partial unique index (the WHERE predicate),
-- so it is hand-written here. Approved/rejected rows are unconstrained, so a
-- section can be reopened, re-submitted, and requested again. This is the
-- durable guarantee behind the friendly application-level "already pending"
-- error and the race guard between two concurrent requestReopen calls.
CREATE UNIQUE INDEX "ReopenRequest_one_pending_per_section"
  ON "ReopenRequest"("reportSectionId")
  WHERE "status" = 'pending';

-- review-acknowledgement: reviewer designation flag on the viewer↔group access
-- row. Per-row, so a canReview grant never crosses groups.
ALTER TABLE "ViewerGroupAccess" ADD COLUMN "canReview" BOOLEAN NOT NULL DEFAULT false;

-- review-acknowledgement: per-section verdict enum.
CREATE TYPE "ReviewVerdict" AS ENUM ('approved', 'changes_requested');

-- CreateTable: group-level "seen" receipt, one per (acknowledger, group, period).
CREATE TABLE "ReviewAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: per-section verdict (approved | changes_requested), bound to the
-- ReportSection.version it judged so re-submission auto-stales it.
CREATE TABLE "SectionReview" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "verdict" "ReviewVerdict" NOT NULL,
    "judgedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reviewer comment anchored to exactly one concrete record.
CREATE TABLE "RecordComment" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "itemId" TEXT,
    "riskId" TEXT,
    "decisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecordComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAcknowledgement_userId_reportId_groupId_key" ON "ReviewAcknowledgement"("userId", "reportId", "groupId");
CREATE INDEX "ReviewAcknowledgement_reportId_groupId_idx" ON "ReviewAcknowledgement"("reportId", "groupId");
CREATE UNIQUE INDEX "SectionReview_reportSectionId_reviewerId_key" ON "SectionReview"("reportSectionId", "reviewerId");
CREATE INDEX "SectionReview_reportSectionId_idx" ON "SectionReview"("reportSectionId");
CREATE INDEX "RecordComment_itemId_idx" ON "RecordComment"("itemId");
CREATE INDEX "RecordComment_riskId_idx" ON "RecordComment"("riskId");
CREATE INDEX "RecordComment_decisionId_idx" ON "RecordComment"("decisionId");
CREATE INDEX "RecordComment_reviewerId_idx" ON "RecordComment"("reviewerId");

-- AddForeignKey
ALTER TABLE "ReviewAcknowledgement" ADD CONSTRAINT "ReviewAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAcknowledgement" ADD CONSTRAINT "ReviewAcknowledgement_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAcknowledgement" ADD CONSTRAINT "ReviewAcknowledgement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReportingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionReview" ADD CONSTRAINT "SectionReview_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionReview" ADD CONSTRAINT "SectionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- review-acknowledgement: a RecordComment anchors to EXACTLY ONE record. Prisma
-- cannot express a CHECK, so it is hand-written here as defence-in-depth behind
-- the Zod input guard: exactly one of itemId / riskId / decisionId is non-null.
ALTER TABLE "RecordComment"
  ADD CONSTRAINT "RecordComment_exactly_one_anchor_check"
  CHECK (
    (("itemId" IS NOT NULL)::int
      + ("riskId" IS NOT NULL)::int
      + ("decisionId" IS NOT NULL)::int) = 1
  );
