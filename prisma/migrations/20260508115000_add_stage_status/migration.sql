-- Persist SDLC traffic-light status per report section, project, and stage.
-- ProjectStatus remains as the derived product aggregate for older report
-- surfaces, while StageStatus becomes the source for lead-form stage chips.
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

CREATE UNIQUE INDEX "StageStatus_reportSectionId_projectId_stageId_key"
ON "StageStatus"("reportSectionId", "projectId", "stageId");

CREATE INDEX "StageStatus_projectId_idx" ON "StageStatus"("projectId");
CREATE INDEX "StageStatus_stageId_idx" ON "StageStatus"("stageId");

ALTER TABLE "StageStatus"
ADD CONSTRAINT "StageStatus_reportSectionId_fkey"
FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StageStatus"
ADD CONSTRAINT "StageStatus_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StageStatus"
ADD CONSTRAINT "StageStatus_stageId_fkey"
FOREIGN KEY ("stageId") REFERENCES "Stage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
