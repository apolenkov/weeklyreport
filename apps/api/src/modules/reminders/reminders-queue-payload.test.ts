import type { AdminReminderExecution } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type {
  DeadlineReminderPayload,
  EscalationReminderPayload,
} from "./reminders.types.js";
import {
  buildQueuePayload,
  parseReminderQueueJobData,
  requireRulePeriodLabel,
} from "./reminders-queue-payload.js";
import { toQueuePayload } from "./reminders-row-mappers.js";

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
  it("rejects recovery when its rule has no period label", async () => {
    const repository = {
      getRulePeriodLabel: () => Promise.resolve(null),
    };

    await expect(
      requireRulePeriodLabel(repository, execution.ruleId),
    ).rejects.toThrow(
      `Reminder rule ${execution.ruleId} has no report period.`,
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
      contractVersion: 1,
      executionId: execution.id,
      recipientEmail: RECIPIENT_EMAIL,
      kind: "deadline",
      cycleDate: payload.cycleDate,
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
      contractVersion: 1,
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

describe("toQueuePayload", () => {
  it("accepts a complete persisted payload", () => {
    const payload: DeadlineReminderPayload = {
      kind: "deadline",
      cycleDate: "2026-04-07",
      leadName: "Test Lead",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: "2026-04-13T18:00:00.000Z",
      sectionUrl: "https://example.test/reports/current",
      organization,
    };

    expect(toQueuePayload(payload)).toEqual(payload);
  });

  it.each([
    null,
    { kind: "deadline" },
    {
      kind: "deadline",
      cycleDate: "not-a-date",
      leadName: "Test Lead",
      reportPeriod: "Week",
      deadlineIso: "2026-04-13T18:00:00.000Z",
      sectionUrl: "https://example.test/reports/current",
      organization,
    },
    {
      kind: "escalation",
      cycleDate: "2026-04-07",
      headName: "Test Head",
      reportPeriod: "Week",
      lateLeads: [],
      organization,
    },
  ])("rejects malformed persisted payload %#", (payload) => {
    expect(toQueuePayload(payload)).toBeNull();
  });
});

describe("parseReminderQueueJobData", () => {
  it("accepts a complete current envelope with trace context", () => {
    const payload = buildQueuePayload(execution, RECIPIENT_EMAIL, {
      kind: "deadline",
      cycleDate: "2026-04-07",
      leadName: "Test Lead",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: "2026-04-13T18:00:00.000Z",
      sectionUrl: "https://example.test/reports/current",
      organization,
    });

    expect(
      parseReminderQueueJobData({
        ...payload,
        correlationId: "request-1",
      }),
    ).toEqual({ ...payload, correlationId: "request-1" });
  });

  it("rejects the former kind-less queue shape", () => {
    expect(() =>
      parseReminderQueueJobData({
        executionId: execution.id,
        recipientEmail: RECIPIENT_EMAIL,
        reportPeriod: "2026-04-07 → 2026-04-13",
      }),
    ).toThrow();
  });

  it("rejects a rich pre-contract envelope without a contract version", () => {
    expect(() =>
      parseReminderQueueJobData({
        executionId: execution.id,
        recipientEmail: RECIPIENT_EMAIL,
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
      }),
    ).toThrow();
  });
});
