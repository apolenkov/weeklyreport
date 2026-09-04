CREATE TABLE "AgentationSession" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "projectId" TEXT NOT NULL DEFAULT 'weekly-report',
    "metadata" JSONB,
    "authorUserId" TEXT NOT NULL,
    "authorReportingGroupId" TEXT,
    "authorRole" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentationAnnotation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "elementPath" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "selectedText" TEXT,
    "boundingBox" JSONB,
    "nearbyText" TEXT,
    "cssClasses" TEXT,
    "nearbyElements" TEXT,
    "computedStyles" TEXT,
    "fullPath" TEXT,
    "accessibility" TEXT,
    "isMultiSelect" BOOLEAN NOT NULL DEFAULT false,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "reactComponents" TEXT,
    "sourceFile" TEXT,
    "drawingIndex" INTEGER,
    "elementBoundingBoxes" JSONB,
    "placement" JSONB,
    "rearrange" JSONB,
    "url" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'feedback',
    "intent" TEXT,
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "authorUserId" TEXT NOT NULL,
    "authorReportingGroupId" TEXT,
    "authorRole" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentationAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentationSession_authorUserId_createdAt_idx" ON "AgentationSession"("authorUserId", "createdAt" DESC);
CREATE INDEX "AgentationSession_status_createdAt_idx" ON "AgentationSession"("status", "createdAt" DESC);
CREATE INDEX "AgentationAnnotation_sessionId_timestamp_idx" ON "AgentationAnnotation"("sessionId", "timestamp");
CREATE INDEX "AgentationAnnotation_status_createdAt_idx" ON "AgentationAnnotation"("status", "createdAt");
CREATE INDEX "AgentationAnnotation_authorUserId_status_createdAt_idx" ON "AgentationAnnotation"("authorUserId", "status", "createdAt");
CREATE UNIQUE INDEX "AgentationSession_authorUserId_url_key" ON "AgentationSession"("authorUserId", "url");
CREATE UNIQUE INDEX "AgentationAnnotation_sessionId_authorUserId_clientId_key" ON "AgentationAnnotation"("sessionId", "authorUserId", "clientId");

ALTER TABLE "AgentationSession" ADD CONSTRAINT "AgentationSession_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentationAnnotation" ADD CONSTRAINT "AgentationAnnotation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentationAnnotation" ADD CONSTRAINT "AgentationAnnotation_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "AgentationEvent_sequence_seq";
CREATE TABLE "AgentationEvent" (
    "id" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL DEFAULT nextval('"AgentationEvent_sequence_seq"'),
    "type" TEXT NOT NULL,
    "sessionId" TEXT,
    "annotationId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorUserId" TEXT,
    CONSTRAINT "AgentationEvent_pkey" PRIMARY KEY ("id")
);
ALTER SEQUENCE "AgentationEvent_sequence_seq" OWNED BY "AgentationEvent"."sequence";
CREATE UNIQUE INDEX "AgentationEvent_sequence_key" ON "AgentationEvent"("sequence");
CREATE INDEX "AgentationEvent_sessionId_sequence_idx" ON "AgentationEvent"("sessionId", "sequence");
ALTER TABLE "AgentationEvent" ADD CONSTRAINT "AgentationEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentationEvent" ADD CONSTRAINT "AgentationEvent_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AgentationThreadMessage" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentationThreadMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgentationThreadMessage_annotationId_timestamp_idx" ON "AgentationThreadMessage"("annotationId", "timestamp");
CREATE INDEX "AgentationThreadMessage_authorUserId_idx" ON "AgentationThreadMessage"("authorUserId");
ALTER TABLE "AgentationThreadMessage" ADD CONSTRAINT "AgentationThreadMessage_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "AgentationAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentationThreadMessage" ADD CONSTRAINT "AgentationThreadMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
