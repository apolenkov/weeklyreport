import type { AdminReminderExecution } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type {
  DeadlineReminderPayload,
  EscalationReminderPayload,
} from "./reminders.types.js";
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

describe("buildQueuePayload", () => {
  it("uses a human-readable period label for the legacy payload", () => {
    const payload = buildQueuePayload(execution, RECIPIENT_EMAIL, {
      reportPeriod: "2026-04-07 → 2026-04-13",
    });

    expect(payload.reportPeriod).toBe("2026-04-07 → 2026-04-13");
    expect(payload.reportPeriod).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("preserves the rich deadline payload", () => {
    const payload: DeadlineReminderPayload = {
      kind: "deadline",
      cycleDate: "2026-04-07",
      leadName: "Test Lead",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: "2026-04-13T18:00:00.000Z",
      sectionUrl: "https://example.test/reports/current",
      organization,
    };

    expect(buildQueuePayload(execution, RECIPIENT_EMAIL, payload)).toEqual({
      executionId: execution.id,
      recipientEmail: RECIPIENT_EMAIL,
      kind: "deadline",
      leadName: payload.leadName,
      reportPeriod: payload.reportPeriod,
      deadlineIso: payload.deadlineIso,
      sectionUrl: payload.sectionUrl,
      organization,
    });
  });

  it("preserves the rich escalation payload", () => {
    const payload: EscalationReminderPayload = {
      kind: "escalation",
      cycleDate: "2026-04-07",
      headName: "Test Head",
      reportPeriod: "2026-04-07 → 2026-04-13",
      lateLeads: [
        {
          leadName: "Test Lead",
          sectionTitle: "Test Group",
          deadlineIso: "2026-04-13T18:00:00.000Z",
        },
      ],
      organization,
    };

    expect(buildQueuePayload(execution, RECIPIENT_EMAIL, payload)).toEqual({
      executionId: execution.id,
      recipientEmail: RECIPIENT_EMAIL,
      kind: "escalation",
      headName: payload.headName,
      cycleDate: payload.cycleDate,
      reportPeriod: payload.reportPeriod,
      lateLeads: payload.lateLeads,
      organization,
    });
  });
});
