-- CreateIndex
CREATE INDEX "Decision_reportSectionId_idx" ON "Decision"("reportSectionId");

-- CreateIndex
CREATE INDEX "Item_reportSectionId_idx" ON "Item"("reportSectionId");

-- CreateIndex
CREATE INDEX "Item_projectId_idx" ON "Item"("projectId");

-- CreateIndex
CREATE INDEX "PdfExportJob_reportId_idx" ON "PdfExportJob"("reportId");

-- CreateIndex
CREATE INDEX "PdfExportJob_status_createdAt_idx" ON "PdfExportJob"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Project_leadId_idx" ON "Project"("leadId");

-- CreateIndex
CREATE INDEX "Project_archived_idx" ON "Project"("archived");

-- CreateIndex
CREATE INDEX "ReminderExecution_createdAt_idx" ON "ReminderExecution"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderExecution_ruleId_idx" ON "ReminderExecution"("ruleId");

-- CreateIndex
CREATE INDEX "ReminderExecution_status_idx" ON "ReminderExecution"("status");

-- CreateIndex
CREATE INDEX "ReminderRule_createdAt_idx" ON "ReminderRule"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderRule_status_fireAt_idx" ON "ReminderRule"("status", "fireAt");

-- CreateIndex
CREATE INDEX "Report_periodStart_idx" ON "Report"("periodStart" DESC);

-- CreateIndex
CREATE INDEX "Report_status_periodStart_idx" ON "Report"("status", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "ReportSection_authorId_idx" ON "ReportSection"("authorId");

-- CreateIndex
CREATE INDEX "ReportSection_status_idx" ON "ReportSection"("status");

-- CreateIndex
CREATE INDEX "Risk_reportSectionId_idx" ON "Risk"("reportSectionId");

-- CreateIndex
CREATE INDEX "Risk_projectId_idx" ON "Risk"("projectId");
