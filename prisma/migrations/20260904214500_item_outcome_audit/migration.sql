BEGIN;

ALTER TABLE "Item" ADD COLUMN "resolution" JSONB;
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_resolution_check"
  CHECK ("resolution" IS NULL OR COALESCE((
    jsonb_typeof("resolution") = 'object'
    AND "resolution" ->> 'kind' = 'wont_do'
    AND jsonb_typeof("resolution" -> 'reason') = 'string'
    AND btrim("resolution" ->> 'reason') <> ''
    AND jsonb_typeof("resolution" -> 'previousState') = 'object'
    AND jsonb_typeof("resolution" -> 'actorName') = 'string'
    AND btrim("resolution" ->> 'actorName') <> ''
    AND "resolution" ?& ARRAY['eventId', 'actorId', 'actorName', 'occurredAt', 'previousState']
  ), false));

CREATE TABLE "ItemOutcomeEvent" (
  "id" TEXT NOT NULL,
  "reportSectionId" TEXT NOT NULL,
  "stableId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "reason" TEXT,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceReportId" TEXT,
  "beforeState" JSONB NOT NULL,
  "afterState" JSONB NOT NULL,
  "reversesEventId" TEXT,
  CONSTRAINT "ItemOutcomeEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemOutcomeEvent_outcome_check"
    CHECK ("outcome" IN ('done', 'continue', 'plan_next', 'wont_do', 'restore')),
  CONSTRAINT "ItemOutcomeEvent_reason_check"
    CHECK (("outcome" = 'wont_do' AND "reason" IS NOT NULL AND btrim("reason") <> '')
      OR ("outcome" <> 'wont_do' AND "reason" IS NULL)),
  CONSTRAINT "ItemOutcomeEvent_restore_check"
    CHECK (("outcome" = 'restore') = ("reversesEventId" IS NOT NULL)),
  CONSTRAINT "ItemOutcomeEvent_request_hash_check"
    CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ItemOutcomeEvent_actor_check"
    CHECK (btrim("actorId") <> '' AND btrim("actorName") <> ''),
  CONSTRAINT "ItemOutcomeEvent_state_check"
    CHECK (jsonb_typeof("beforeState") = 'object' AND jsonb_typeof("afterState") = 'object'),
  CONSTRAINT "ItemOutcomeEvent_reportSectionId_fkey"
    FOREIGN KEY ("reportSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ItemOutcomeEvent_reportSectionId_stableId_occurredAt_idx"
  ON "ItemOutcomeEvent"("reportSectionId", "stableId", "occurredAt");
CREATE INDEX "ItemOutcomeEvent_stableId_occurredAt_idx"
  ON "ItemOutcomeEvent"("stableId", "occurredAt");

COMMIT;
