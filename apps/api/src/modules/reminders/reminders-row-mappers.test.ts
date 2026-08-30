import { describe, expect, it } from "vitest";

import {
  toExecutionCreateData,
  toExecutionDomain,
} from "./reminders-row-mappers.js";

// The recipient identity MUST come from the persisted recipientEmail column,
// never by parsing the dedupeKey back apart. A row whose dedupeKey embeds a
// different address than the column (e.g. after a re-mail) must surface the
// column value — the old extractRecipientEmail(dedupeKey) behavior failed this.
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
    rule: { reportId: null },
  };

  it("toExecutionDomain reads recipientEmail from the column, not the dedupeKey", () => {
    const execution = toExecutionDomain(row);
    expect(execution.recipientEmail).toBe("column-owner@test.local");
  });

  it("toExecutionCreateData persists recipientEmail verbatim", () => {
    const createData = toExecutionCreateData(
      {
        id: row.id,
        ruleId: row.ruleId,
        reportId: null,
        dedupeKey: row.dedupeKey,
        status: "queued",
        scheduledFor: row.createdAt,
        sentAt: null,
        recipientEmail: row.recipientEmail,
        errorMessage: null,
      },
      {
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
});
