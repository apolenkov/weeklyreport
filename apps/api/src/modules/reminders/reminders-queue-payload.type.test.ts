import type { AdminReminderExecution } from "@customreport/shared";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { DeadlineReminderPayload } from "./reminders.types.js";
import { buildQueuePayload } from "./reminders-queue-payload.js";

const RECIPIENT_EMAIL = "lead@test.local";
const execution: AdminReminderExecution = {
  id: "20000000-0000-4000-8000-000000000001",
  ruleId: "20000000-0000-4000-8000-000000000002",
  reportId: "20000000-0000-4000-8000-000000000003",
  dedupeKey: "dedupe-key",
  status: "queued",
  scheduledFor: new Date("2026-04-07T09:00:00.000Z"),
  sentAt: null,
  recipientEmail: RECIPIENT_EMAIL,
  errorMessage: null,
};

const organization = {
  shortName: "CustomReport",
  fullName: "CustomReport Department",
};

const deadline: DeadlineReminderPayload = {
  kind: "deadline",
  cycleDate: "2026-04-07",
  leadName: "Test Lead",
  reportPeriod: "2026-04-07 → 2026-04-13",
  deadlineIso: "2026-04-13T18:00:00.000Z",
  sectionUrl: "https://example.test/reports/current",
  organization,
};

// The builder used to erase its known payload union to `Record<string, unknown>`;
// the concrete union must survive so the worker keeps the per-kind fields.
describe("buildQueuePayload return type", () => {
  it("returns a concrete payload union, not a generic record", () => {
    expectTypeOf(
      buildQueuePayload(execution, RECIPIENT_EMAIL, deadline),
    ).not.toEqualTypeOf<Record<string, unknown>>();
  });

  it("narrows the built payload to the per-kind fields", () => {
    const built = buildQueuePayload(execution, RECIPIENT_EMAIL, deadline);
    expect("kind" in built).toBe(true);
    if ("kind" in built && built.kind === "deadline") {
      expect(built.leadName).toBe(deadline.leadName);
      expect(built.deadlineIso).toBe(deadline.deadlineIso);
    } else {
      throw new Error("expected a deadline-kind payload");
    }
  });
});
