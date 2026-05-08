CREATE TABLE "ReportingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportingGroup_archived_idx" ON "ReportingGroup"("archived");

INSERT INTO "ReportingGroup" ("id", "name", "description", "archived", "createdAt", "updatedAt")
VALUES (
    'a0000000-0000-4000-8000-000000000301',
    'Core Development',
    'Default reporting group for CustomReport demo users',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "User" ADD COLUMN "reportingGroupId" TEXT;

UPDATE "User"
SET "reportingGroupId" = 'a0000000-0000-4000-8000-000000000301'
WHERE "reportingGroupId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "reportingGroupId" SET NOT NULL;

CREATE INDEX "User_reportingGroupId_idx" ON "User"("reportingGroupId");

ALTER TABLE "User"
ADD CONSTRAINT "User_reportingGroupId_fkey"
FOREIGN KEY ("reportingGroupId") REFERENCES "ReportingGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
