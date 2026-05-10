-- UFB-055 / Phase 54 (seeds-only): AiIngestionJob stub queue.
--
-- Seeds-only scaffolding for the future AI/RAG pipeline. When a report is
-- published, one row per section will be enqueued here for later batch
-- processing by a worker that will call an LLM / embedding provider.
-- No provider is wired in this phase — the table just accumulates rows so
-- the cutover to a real adapter is a code change, not a data-model change.
--
-- Migration is purely additive. Existing rows in ReportSection are not
-- touched. The inverse relation on ReportSection is a Prisma client-side
-- concept and does not produce SQL here beyond the FK below.
--
-- Status state machine: pending | processed | failed | skipped.
-- Idempotency: NO unique constraint on (reportSectionId) — re-publishing
-- a period (after reopen) intentionally enqueues a fresh row so the
-- worker re-embeds the latest text. The worker is expected to dedupe by
-- content hash on its side.

-- CreateTable
CREATE TABLE "AiIngestionJob" (
    "id" TEXT NOT NULL,
    "reportSectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AiIngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiIngestionJob_status_createdAt_idx" ON "AiIngestionJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiIngestionJob_reportSectionId_idx" ON "AiIngestionJob"("reportSectionId");

-- AddForeignKey
ALTER TABLE "AiIngestionJob" ADD CONSTRAINT "AiIngestionJob_reportSectionId_fkey" FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
