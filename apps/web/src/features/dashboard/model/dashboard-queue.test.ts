import { reportSectionReadModelSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import { contentSummary } from "../ui/lead-row-format";
import { mapReviewDashboardData, mapWeeklyDashboardData } from "./dashboard";
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

describe("dashboard submissions KPI", () => {
  it("adds up when org-wide totals exceed the visible group sections", () => {
    const groupSections = Array.from({ length: 8 }, (_, index) =>
      queueSection(
        queueLeadId(index + 1),
        `Lead ${index + 1}`,
        index < 3 ? "submitted" : "draft",
      ),
    );
    // Head sees 8 group sections but the report counts 3 of 10 org-wide.
    const { kpi } = mapWeeklyDashboardData({
      weeklyReport: queueReport(groupSections, "open", 10),
    });

    expect([kpi.submitted, kpi.total, kpi.pendingCount]).toEqual([3, 10, 7]);
  });
});

describe("dashboard risk KPI", () => {
  it("counts the same rows the Blocked & At Risk list renders", () => {
    const productId = "50000000-0000-4000-8000-000000000001";
    const common = {
      productId,
      productName: "Platform",
      authorId: queueLeadId(1),
      leadName: "Alex Lead",
    };
    const weeklyReport = {
      ...queueReport([]),
      // The red roll-up is folded into the concrete stage escalations.
      escalations: [
        {
          ...common,
          type: "blocked" as const,
          stageName: "Development",
          description: "blocked detail",
        },
        {
          ...common,
          type: "unresolved_risk" as const,
          stageName: "Testing",
          description: "risk detail",
        },
        {
          ...common,
          type: "at_risk" as const,
          stageName: null,
          description: "roll-up",
        },
      ],
    };

    const { kpi, blockedAtRisk } = mapWeeklyDashboardData({ weeklyReport });

    expect(blockedAtRisk).toHaveLength(2);
    expect([kpi.blockedCount, kpi.atRiskCount]).toEqual([1, 1]);
  });
});

describe("dashboard lead queue", () => {
  it("suppresses a red roll-up only for its exact product id", () => {
    const firstProductId = "50000000-0000-4000-8000-000000000001";
    const secondProductId = "50000000-0000-4000-8000-000000000002";
    const sharedProductName = "Platform";
    const weeklyReport = {
      ...queueReport([]),
      escalations: [
        {
          type: "blocked" as const,
          productId: firstProductId,
          productName: sharedProductName,
          stageName: "Development",
          authorId: queueLeadId(1),
          leadName: "Alex Lead",
          description: "Concrete first-product blocker",
        },
        {
          type: "at_risk" as const,
          productId: firstProductId,
          productName: sharedProductName,
          stageName: null,
          authorId: queueLeadId(1),
          leadName: "Alex Lead",
          description: "Red roll-up for first product",
        },
        {
          type: "at_risk" as const,
          productId: secondProductId,
          productName: sharedProductName,
          stageName: null,
          authorId: queueLeadId(2),
          leadName: "Alex Lead",
          description: "Red roll-up for second product",
        },
      ],
    };

    expect(
      mapWeeklyDashboardData({ weeklyReport }).blockedAtRisk.map(
        ({ productId, stage, severity, productFlaggedRed, description }) => ({
          productId,
          stage,
          severity,
          productFlaggedRed,
          description,
        }),
      ),
    ).toEqual([
      {
        productId: firstProductId,
        stage: "Development",
        severity: "blocked",
        productFlaggedRed: true,
        description: "Concrete first-product blocker",
      },
      {
        productId: secondProductId,
        stage: "Flagged",
        severity: "at-risk",
        productFlaggedRed: true,
        description: "Red roll-up for second product",
      },
    ]);
  });

  it("counts a prioritized product item as one record and one priority", () => {
    const row = queueReviewRow(queueLeadId(1), "Priya Priority");
    const section = reportSectionReadModelSchema.parse({
      ...queueSection(row.leadId, row.leadName, "draft"),
      projects: [
        {
          projectId: "40000000-0000-4000-8000-000000000001",
          projectName: "Priority product",
          trafficLight: null,
          ownedStages: [],
          stageSet: [],
          ownerGroupId: null,
        },
      ],
      items: [
        {
          id: "40000000-0000-4000-8000-000000000002",
          projectId: "40000000-0000-4000-8000-000000000001",
          activityId: null,
          type: "current",
          text: "One prioritized product item",
          tag: "priority",
          workflowStatus: "done",
          carriedOver: false,
          priorityRank: 1,
          stageNames: ["Planning"],
        },
      ],
    });
    const mapped = mapReviewDashboardData({
      review: [row],
      weeklyReport: queueReport([section]),
      now: QUEUE_NOW,
    });
    const lead = expectDefined(mapped.leads[0]);

    expect(lead).toMatchObject({
      reportContentCount: 1,
      currentItemCount: 1,
      priorityCount: 1,
      activityCount: 0,
    });
    expect(contentSummary(lead)).toBe("1 record · No signal");
  });

  it("joins scoped identity, weekly review state, and activity freshness once", () => {
    const missingId = queueLeadId(1);
    const draft = queueReviewRow(queueLeadId(2), "Dana Draft");
    const submitted = queueReviewRow(queueLeadId(3), "Riley Review");
    const mapped = mapReviewDashboardData({
      review: [draft, submitted],
      weeklyReport: queueReport([
        queueSection(draft.leadId, draft.leadName, "draft"),
        queueSection(submitted.leadId, submitted.leadName, "submitted", {
          canReview: true,
          reviews: [queueVerdict("approved", false)],
        }),
      ]),
      activity: queueActivity([
        {
          ...queueActivityRow(missingId, "Nora No Section"),
          reportSectionId: null,
        },
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
        reminderRuleId: "a0000000-0000-4000-a000-000000000600",
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

  it("offers no reminder action without an active deadline rule", () => {
    const row = queueReviewRow(queueLeadId(1), "Dana Draft");
    const weeklyReport = {
      ...queueReport([queueSection(row.leadId, row.leadName, "draft")]),
      activeDeadlineReminderRuleId: null,
    };
    const mapped = mapReviewDashboardData({
      review: [row],
      weeklyReport,
      activity: queueActivity([
        queueActivityRow(row.leadId, row.leadName, { content: 1 }),
      ]),
      now: QUEUE_NOW,
    });

    expect(mapped.leads[0]).toMatchObject({
      reminderRuleId: null,
      actions: { canRemind: false },
    });
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
    const noSection = queueReviewRow(queueLeadId(2), "Nora NoSection");
    const mapped = mapReviewDashboardData({
      review: [],
      weeklyReport: queueReport(
        [
          {
            ...queueSection(row.leadId, row.leadName, "submitted", {
              canReview: true,
            }),
            items: [
              {
                type: "current",
                text: "Published item",
                tag: "",
                workflowStatus: "done",
                carriedOver: false,
                projectId: null,
                stageNames: [],
              },
            ],
          },
        ],
        "published",
        2,
      ),
      activity: queueActivity(
        [
          queueActivityRow(row.leadId, row.leadName, { status: "submitted" }),
          {
            ...queueActivityRow(noSection.leadId, noSection.leadName),
            reportSectionId: null,
          },
        ],
        "published",
      ),
      now: QUEUE_NOW,
    });

    const publishedRow = mapped.leads.find((lead) => lead.id === row.leadId);
    const noSectionRow = mapped.leads.find(
      (lead) => lead.id === noSection.leadId,
    );
    expect(publishedRow?.actions).toEqual({
      canOpen: true,
      canRemind: false,
      canReview: false,
      canRequestChanges: false,
      canRevoke: false,
    });
    expect(mapped.leads).toHaveLength(2);
    expect(noSectionRow).toMatchObject({
      id: noSection.leadId,
      name: "Nora N.",
    });
    expect(noSectionRow?.actions).toEqual({
      canOpen: false,
      canRemind: false,
      canReview: false,
      canRequestChanges: false,
      canRevoke: false,
    });
  });

  it("renders weekly section rows before review and activity resolve", () => {
    const row = queueReviewRow(queueLeadId(1), "Wendy Weekly");
    const mapped = mapReviewDashboardData({
      weeklyReport: queueReport([
        queueSection(row.leadId, row.leadName, "submitted"),
      ]),
      now: QUEUE_NOW,
    });

    expect(mapped.leads).toHaveLength(1);
    expect(mapped.leads[0]).toMatchObject({
      id: row.leadId,
      name: "Wendy W.",
      status: "submitted",
    });
  });
});
