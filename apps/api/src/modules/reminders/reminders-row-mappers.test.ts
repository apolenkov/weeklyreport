import { describe, expect, it } from "vitest";

import {
  toExecutionCreateData,
  toExecutionDomain,
  toRuleDomain,
} from "./reminders-row-mappers.js";

// The recipient identity MUST come from the persisted recipientEmail column,
// never by parsing the dedupeKey back apart. A row whose dedupeKey embeds a
// different address than the column (e.g. after a re-mail) must surface the
// column value, even when the dedupe key carries a different address.
describe("reminder execution row mapping — recipient identity", () => {
  const row = {
    id: "99999999-9999-4999-8999-999999999998",
    ruleId: "66666666-6666-4666-8666-666666666666",
    recipientEmail: "column-owner@test.local",
    dedupeKey:
      "66666666-6666-4666-8666-666666666666:deadline:2026-04-12:key-embedded@test.local",
    status: "pending" as const,
    sentAt: null,
    error: null,
    createdAt: new Date("2026-04-12T09:00:00.000Z"),
    updatedAt: new Date("2026-04-12T09:00:00.000Z"),
    rule: {
      reportId: "77777777-7777-4777-8777-777777777777",
      fireAt: new Date("2026-04-10T15:00:00.000Z"),
    },
  };

  it("toExecutionDomain reads recipientEmail from the column, not the dedupeKey", () => {
    const execution = toExecutionDomain(row);
    expect(execution.recipientEmail).toBe("column-owner@test.local");
    expect(execution.scheduledFor).toEqual(row.rule.fireAt);
    expect(execution.scheduledFor).not.toEqual(row.createdAt);
  });

  it("toExecutionCreateData persists recipientEmail verbatim", () => {
    const createData = toExecutionCreateData(
      {
        id: row.id,
        ruleId: row.ruleId,
        reportId: row.rule.reportId,
        dedupeKey: row.dedupeKey,
        status: "queued",
        scheduledFor: row.createdAt,
        sentAt: null,
        recipientEmail: row.recipientEmail,
        errorMessage: null,
      },
      {
        contractVersion: 1,
        kind: "deadline",
        cycleDate: "2026-04-12",
        leadName: "Lead One",
        reportPeriod: "2026-04-06 → 2026-04-12",
        deadlineIso: "2026-04-12T09:00:00.000Z",
        sectionUrl:
          "http://localhost:3000/lead/report/22222222-2222-4222-8222-222222222222",
        organization: {
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        },
      },
    );
    expect(createData.recipientEmail).toBe("column-owner@test.local");
  });

  it("toRuleDomain preserves mandatory report and policy ownership", () => {
    const rule = toRuleDomain({
      id: "66666666-6666-4666-8666-666666666666",
      reportId: "77777777-7777-4777-8777-777777777777",
      policyId: "88888888-8888-4888-8888-888888888888",
      kind: "deadline",
      fireAt: new Date("2026-04-12T09:00:00.000Z"),
      timezone: "Europe/Moscow",
      status: "active",
      version: 1,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(rule).toMatchObject({
      reportId: "77777777-7777-4777-8777-777777777777",
      policyId: "88888888-8888-4888-8888-888888888888",
    });
  });
});
