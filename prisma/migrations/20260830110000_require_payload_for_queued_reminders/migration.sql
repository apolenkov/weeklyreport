-- A rich renderer snapshot did not exist for executions written before the
-- queue-payload contract. Fabricating names, brand, URLs or escalation digests
-- would corrupt delivery semantics, so quarantine only still-queued rows. The
-- next eligible scheduler/manual dispatch revives them with a current payload.
UPDATE "ReminderExecution"
SET
  "status" = 'failed',
  "error" = COALESCE(
    "error",
    'Payload contract upgraded; awaiting current-contract redispatch.'
  )
WHERE "status" = 'pending' AND "queuePayload" IS NULL;

ALTER TABLE "ReminderExecution"
ADD CONSTRAINT "ReminderExecution_queued_requires_queue_payload"
CHECK ("status" <> 'pending' OR "queuePayload" IS NOT NULL);
