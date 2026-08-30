import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20260830110000_require_payload_for_queued_reminders/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("queued reminder payload migration", () => {
  it("quarantines payload-less queued rows before enforcing the invariant", () => {
    const quarantine = migration.indexOf(
      'WHERE "status" = \'pending\' AND "queuePayload" IS NULL',
    );
    const constraint = migration.indexOf(
      'ADD CONSTRAINT "ReminderExecution_queued_requires_queue_payload"',
    );

    expect(quarantine).toBeGreaterThanOrEqual(0);
    expect(constraint).toBeGreaterThan(quarantine);
    expect(migration).toContain(
      'CHECK ("status" <> \'pending\' OR "queuePayload" IS NOT NULL)',
    );
  });
});
