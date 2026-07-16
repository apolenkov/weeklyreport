import { describe, expect, it } from "vitest";

import { mapReviewDashboardData } from "./dashboard";
import {
  QUEUE_NOW,
  queueActivity,
  queueActivityRow,
  queueLeadId,
  queueReport,
  queueReviewRow,
  queueSection,
  queueVerdict,
} from "./dashboard-queue.fixtures";

describe("dashboard lead queue", () => {
  it("joins scoped identity, weekly review state, and activity freshness once", () => {
    const missing = queueReviewRow(queueLeadId(1), "Nora No Section");
    const draft = queueReviewRow(queueLeadId(2), "Dana Draft");
    const submitted = queueReviewRow(queueLeadId(3), "Riley Review");
    const mapped = mapReviewDashboardData({
      review: [missing, draft, submitted],
      weeklyReport: queueReport([
        queueSection(draft.leadId, draft.leadName, "draft"),
        queueSection(submitted.leadId, submitted.leadName, "submitted", {
          canReview: true,
          reviews: [queueVerdict("approved", false)],
        }),
      ]),
      activity: queueActivity([
        queueActivityRow(draft.leadId, draft.leadName, {
          content: 2,
          lastEditAt: new Date("2026-07-16T11:30:00.000Z"),
        }),
        queueActivityRow(submitted.leadId, submitted.leadName, {
          content: 1,
          lastEditAt: new Date("2026-07-16T10:00:00.000Z"),
          status: "submitted",
        }),
      ]),
      now: QUEUE_NOW,
    });

    expect(new Set(mapped.leads.map((lead) => lead.id)).size).toBe(3);
    expect(mapped.leads.find((lead) => lead.id === draft.leadId)).toMatchObject(
      {
        status: "draft",
        lastEditAt: new Date("2026-07-16T11:30:00.000Z"),
        reviewLabel: "Not reviewed",
        actions: { canOpen: true, canRemind: true },
      },
    );
    expect(
      mapped.leads.find((lead) => lead.id === submitted.leadId),
    ).toMatchObject({
      reviewLabel: "Awaiting review",
      actions: { canReview: true, canRequestChanges: true, canRevoke: true },
    });
    expect(mapped.pendingLeads).toEqual(["Nora N.S."]);
  });

  it("orders action-needed, stale, active, and completed rows with name ties", () => {
    const rows = [
      queueReviewRow(queueLeadId(1), "Zoe Changes"),
      queueReviewRow(queueLeadId(2), "Amy Review"),
      queueReviewRow(queueLeadId(3), "Sam Stale"),
      queueReviewRow(queueLeadId(4), "Alex Active"),
      queueReviewRow(queueLeadId(5), "Pat Approved"),
    ] as const;
    const sections = [
      queueSection(rows[0].leadId, rows[0].leadName, "draft", {
        canReview: true,
        reviews: [queueVerdict("changes_requested")],
      }),
      queueSection(rows[1].leadId, rows[1].leadName, "submitted", {
        canReview: true,
      }),
      queueSection(rows[2].leadId, rows[2].leadName, "draft"),
      queueSection(rows[3].leadId, rows[3].leadName, "draft"),
      queueSection(rows[4].leadId, rows[4].leadName, "submitted", {
        canReview: true,
        reviews: [queueVerdict("approved")],
      }),
    ];
    const activityRows = rows.map((row, index) =>
      queueActivityRow(row.leadId, row.leadName, {
        content: 1,
        lastEditAt:
          index === 2
            ? new Date("2026-07-14T08:00:00.000Z")
            : new Date("2026-07-16T11:00:00.000Z"),
        ...(index === 1 || index === 4 ? { status: "submitted" } : {}),
      }),
    );
    const mapped = mapReviewDashboardData({
      review: rows,
      weeklyReport: queueReport(sections),
      activity: queueActivity(activityRows),
      now: QUEUE_NOW,
    });

    expect(mapped.leads.map((lead) => [lead.name, lead.priority])).toEqual([
      ["Amy R.", "action-needed"],
      ["Zoe C.", "action-needed"],
      ["Sam S.", "stale"],
      ["Alex A.", "active"],
      ["Pat A.", "complete"],
    ]);
  });

  it("keeps published rows read-only while preserving content navigation", () => {
    const row = queueReviewRow(queueLeadId(1), "Parker Published");
    const mapped = mapReviewDashboardData({
      review: [row],
      weeklyReport: queueReport(
        [
          queueSection(row.leadId, row.leadName, "submitted", {
            canReview: true,
          }),
        ],
        "published",
      ),
      activity: queueActivity(
        [
          queueActivityRow(row.leadId, row.leadName, {
            content: 1,
            status: "submitted",
          }),
        ],
        "published",
      ),
      now: QUEUE_NOW,
    });

    expect(mapped.leads[0]?.actions).toEqual({
      canOpen: true,
      canRemind: false,
      canReview: false,
      canRequestChanges: false,
      canRevoke: false,
    });
  });
});
