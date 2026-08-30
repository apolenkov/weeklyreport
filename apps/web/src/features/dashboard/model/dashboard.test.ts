import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  formatRelativeDeadline,
  mapDashboardData,
  mapReviewDashboardData,
  mapWeeklyDashboardData,
} from "./dashboard";

// v4-shape UUIDs (4 in position 13, 8/9/a/b in position 17).
const REPORT_ID = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const SECTION_A = "11111111-1111-4111-8111-bbbbbbbbbbb1";
const SECTION_B = "11111111-1111-4111-8111-bbbbbbbbbbb2";
const LEAD_A = "11111111-1111-4111-8111-cc0000000001";
const LEAD_B = "11111111-1111-4111-8111-cc0000000002";
const LEAD_C = "11111111-1111-4111-8111-cc0000000003";
const PROJECT_A = "11111111-1111-4111-8111-dd0000000001";
const PROJECT_B = "11111111-1111-4111-8111-dd0000000002";
const ITEM_A = "11111111-1111-4111-8111-aa0000000001";
const ITEM_B = "11111111-1111-4111-8111-aa0000000002";
const DECISION_A = "11111111-1111-4111-8111-ee0000000001";

function makeReview(
  override?: readonly Parameters<
    typeof submissionDashboardRowSchema.parse
  >[0][],
): SubmissionDashboardRow[] {
  if (override) {
    return override.map((row) => submissionDashboardRowSchema.parse(row));
  }
  return [
    submissionDashboardRowSchema.parse({
      leadId: LEAD_A,
      leadName: "Alice Lead",
      role: "lead",
      projectNames: ["CRM Portal"],
      status: "submitted",
      submittedAt: "2026-04-20T10:00:00.000Z",
    }),
    submissionDashboardRowSchema.parse({
      leadId: LEAD_B,
      leadName: "Bob Lead",
      role: "lead",
      projectNames: ["Analytics"],
      status: "draft",
      submittedAt: null,
    }),
    submissionDashboardRowSchema.parse({
      leadId: LEAD_C,
      leadName: "Cara Lead",
      role: "lead",
      projectNames: ["Mobile"],
      status: "draft",
      submittedAt: null,
    }),
  ];
}

function makeWeeklyReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return weeklyReportReadModelSchema.parse({
    reportId: REPORT_ID,
    periodStart: "2026-04-13T00:00:00.000Z",
    periodEnd: "2026-04-19T23:59:59.000Z",
    deadline: "2026-04-17T15:00:00.000Z",
    periodStatus: "open",
    archived: false,
    weekLabel: "Week 16",
    submissionCount: overrides.submissionCount ?? 4,
    totalLeads: overrides.totalLeads ?? 6,
    hasActiveReminderRule: overrides.hasActiveReminderRule ?? true,
    portfolioOverview: overrides.portfolioOverview ?? [
      {
        productId: PROJECT_A,
        productName: "CRM Portal",
        worstStatus: "green",
        stageCount: 3,
        leadNames: ["Alice Lead"],
        leadIds: [LEAD_A],
      },
      {
        productId: PROJECT_B,
        productName: "Analytics",
        worstStatus: "red",
        stageCount: 2,
        leadNames: ["Bob Lead"],
        leadIds: [LEAD_B],
      },
    ],
    leadSections: overrides.leadSections ?? [
      {
        reportSectionId: SECTION_A,
        reportId: REPORT_ID,
        authorId: LEAD_A,
        authorName: "Alice Lead",
        authorRole: "lead",
        version: 1,
        status: "submitted",
        submittedAt: "2026-04-20T10:00:00.000Z",
        late: false,
        projects: [],
        referencedProjects: [],
        items: [
          {
            id: ITEM_A,
            projectId: PROJECT_A,
            type: "current",
            text: "Done thing",
            tag: "Dev",
            workflowStatus: "done",
            carriedOver: false,
            completed: true,
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [
          {
            id: DECISION_A,
            productId: PROJECT_A,
            text: "Approve hire",
            owner: "Head",
            deadline: null,
            impact: "Team capacity",
            resolvedAt: null,
            stageNames: ["Development"],
          },
        ],
        activities: [],
        reviews: [],
      },
      {
        reportSectionId: SECTION_B,
        reportId: REPORT_ID,
        authorId: LEAD_B,
        authorName: "Bob Lead",
        authorRole: "lead",
        version: 1,
        status: "draft",
        submittedAt: null,
        late: false,
        projects: [],
        referencedProjects: [],
        items: [
          {
            id: ITEM_B,
            projectId: PROJECT_B,
            type: "current",
            text: "In flight thing",
            tag: "Dev",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: false,
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
        activities: [],
        reviews: [],
      },
      // Cara has NO section -> 'pending'.
    ],
    escalations: overrides.escalations ?? [
      {
        type: "blocked",
        productName: "Analytics",
        stageName: "Development",
        leadName: "Bob Lead",
        description: "ETL memory leak",
      },
      {
        type: "at_risk",
        productName: "CRM Portal",
        stageName: "Development",
        leadName: "Alice Lead",
        description: "OAuth2 partner delay",
      },
      {
        type: "unresolved_risk",
        productName: "CRM Portal",
        stageName: null,
        leadName: "Alice Lead",
        description: "Carried over risk",
      },
    ],
    ...overrides,
  });
}

describe("formatRelativeDeadline", () => {
  it('returns "Past" when the deadline has passed', () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    const deadline = new Date("2026-04-24T10:00:00.000Z");
    expect(formatRelativeDeadline(deadline, now)).toBe("Past");
  });

  it('returns "Nh" when less than 1 day remains', () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    const deadline = new Date("2026-04-25T15:00:00.000Z");
    expect(formatRelativeDeadline(deadline, now)).toBe("5h");
  });

  it('returns "Nd Mh" when more than a day remains', () => {
    const now = new Date("2026-04-23T10:00:00.000Z");
    const deadline = new Date("2026-04-25T15:00:00.000Z");
    expect(formatRelativeDeadline(deadline, now)).toBe("2d 5h");
  });
});

describe("mapDashboardData", () => {
  it("maps weekly-backed KPI and escalation panels without review data", () => {
    const result = mapWeeklyDashboardData({
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.kpi.total).toBe(6);
    expect(result.kpi.pendingCount).toBe(4);
    expect(result.blockedAtRisk.length).toBeGreaterThan(0);
  });

  it("maps review-backed lead and pending panels from the scoped review rows", () => {
    const result = mapReviewDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
    });
    expect(result.leads).toHaveLength(3);
    expect(result.pendingLeads).toEqual(["Cara L."]);
  });

  it("produces kpi.submitted/total from weeklyReport counts (4/6 case)", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({ submissionCount: 4, totalLeads: 6 }),
      now: new Date("2026-04-17T13:00:00.000Z"),
    });
    expect(result.kpi.submitted).toBe(4);
    expect(result.kpi.total).toBe(6);
  });

  it("computes deadlineLabel relative to weeklyReport.deadline", () => {
    // deadline = 2026-04-17T15:00:00Z, now = 2026-04-17T13:00:00Z -> 2h
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T13:00:00.000Z"),
    });
    expect(result.kpi.deadlineLabel).toBe("2h");
    expect(result.kpi.deadlineTime).toBe("2026-04-17");
  });

  it("does not show a countdown for a published period", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({ periodStatus: "published" }),
      now: new Date("2026-04-17T13:00:00.000Z"),
    });
    expect(result.kpi.deadlineLabel).toBe("Closed");
  });

  it("counts blocked and at-risk escalations into KPI", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.kpi.blockedCount).toBe(1);
    // 1 at_risk + 1 unresolved_risk = 2
    expect(result.kpi.atRiskCount).toBe(2);
  });

  it("sums decisions across all lead sections", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.kpi.decisionCount).toBe(1);
  });

  it("derives lead status: 'submitted' / 'draft' / 'pending' (no section)", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    const alice = result.leads.find((l) => l.id === LEAD_A);
    const bob = result.leads.find((l) => l.id === LEAD_B);
    const cara = result.leads.find((l) => l.id === LEAD_C);
    expect(alice?.status).toBe("submitted");
    expect(bob?.status).toBe("draft");
    expect(cara?.status).toBe("pending");
    expect(alice?.currentItemCount).toBe(1);
    expect(alice?.nextItemCount).toBe(0);
    expect(alice?.riskCount).toBe(0);
    expect(alice?.decisionCount).toBe(1);
    expect(alice?.priorityCount).toBe(0);
    expect(alice?.submittedAtLabel).toBe("2026-04-20");
    expect(bob?.currentItemCount).toBe(1);
    expect(bob?.nextItemCount).toBe(0);
    expect(bob?.submittedAtLabel).toBeNull();
  });

  it("produces pendingLeads as a string[] of pending lead names", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.pendingLeads).toEqual(["Cara L."]);
  });

  // Product health is attributed by lead id, never by display name: a lead
  // whose name collides with the product's leadNames but whose id is not in
  // leadIds must not inherit that product's traffic light.
  it("attributes traffic lights by lead id, not display name", () => {
    const IMPOSTOR_LEAD = "11111111-1111-4111-8111-cc0000000009";
    const weeklyReport = makeWeeklyReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM Portal",
          worstStatus: "red",
          stageCount: 3,
          leadNames: ["Alice Lead"],
          // Same display name as the lead below, different id.
          leadIds: ["11111111-1111-4111-8111-cc0000000000"],
        },
      ],
    });
    const review = makeReview([
      {
        leadId: IMPOSTOR_LEAD,
        leadName: "Alice Lead",
        role: "lead",
        projectNames: ["CRM Portal"],
        status: "submitted",
        submittedAt: "2026-04-20T10:00:00.000Z",
      },
    ]);

    const result = mapDashboardData({
      review,
      weeklyReport,
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    const impostor = result.leads.find((l) => l.id === IMPOSTOR_LEAD);
    expect(impostor).toBeDefined();
    expect(impostor?.trafficLights).toEqual([]);
  });

  // pendingLeads draws from leads ∪ leadSections ∪ activity ∪ review — not
  // review alone; a lead with section/activity still surfaces when scoped
  // review rows omit them (see dashboard-queue "Nora No Section").
  it("pendingLeads includes a lead present via weeklyReport.leadSections but absent from the scoped review rows", () => {
    const LEAD_D = "11111111-1111-4111-8111-cc0000000004";
    const SECTION_D = "11111111-1111-4111-8111-bbbbbbbbbbb3";
    const weeklyReport = makeWeeklyReport({
      leadSections: [
        {
          reportSectionId: SECTION_D,
          reportId: REPORT_ID,
          authorId: LEAD_D,
          authorName: "Denise Draft",
          authorRole: "lead",
          version: 1,
          status: "draft",
          submittedAt: null,
          late: false,
          projects: [],
          referencedProjects: [],
          items: [],
          risks: [],
          decisions: [],
          activities: [],
          reviews: [],
        },
      ],
    });
    const result = mapReviewDashboardData({
      review: makeReview(), // scoped review rows do NOT include Denise
      weeklyReport,
    });
    expect(result.pendingLeads).toEqual(["Bob L.", "Cara L.", "Denise D."]);
  });

  it("empty review (scoped-out caller) yields empty pendingLeads", () => {
    const result = mapDashboardData({
      review: [],
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.pendingLeads).toEqual([]);
  });

  it("derives blockedAtRisk severity correctly from escalation type", () => {
    // Distinct products so the product-level at_risk flag is NOT deduped against
    // a concrete row — this test pins pure type→severity mapping.
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({
        escalations: [
          {
            type: "blocked",
            productName: "Analytics",
            stageName: "Development",
            leadName: "Bob Lead",
            description: "ETL memory leak",
          },
          {
            type: "at_risk",
            productName: "CRM Portal",
            stageName: null,
            leadName: "Alice Lead",
            description: "Project CRM Portal is flagged red.",
          },
          {
            type: "unresolved_risk",
            productName: "Billing",
            stageName: "QA",
            leadName: "Alice Lead",
            description: "Carried over risk",
          },
        ],
      }),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.blockedAtRisk).toHaveLength(3);
    const blocked = result.blockedAtRisk.filter(
      (b) => b.severity === "blocked",
    );
    const atRisk = result.blockedAtRisk.filter((b) => b.severity === "at-risk");
    expect(blocked).toHaveLength(1);
    expect(atRisk).toHaveLength(2);
  });

  it("drops the product-level at_risk flag when the product has a concrete stage row", () => {
    // The "flagged red" roll-up restates a status the ProductCard header already
    // shows; with a concrete blocker on the same product it is redundant noise.
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({
        escalations: [
          {
            type: "blocked",
            productName: "Analytics",
            stageName: "Development",
            leadName: "Bob Lead",
            description: "ETL memory leak",
          },
          {
            type: "at_risk",
            productName: "Analytics",
            stageName: null,
            leadName: "Bob Lead",
            description: "Project Analytics is flagged red.",
          },
        ],
      }),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.blockedAtRisk).toHaveLength(1);
    expect(result.blockedAtRisk[0]?.severity).toBe("blocked");
  });

  it('keeps a lone product-level at_risk flag and labels its stage "Flagged"', () => {
    // A red product with nothing concrete to point at: the flag is the only
    // signal, so it survives — but reads as "Flagged", never "No stage set".
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({
        escalations: [
          {
            type: "at_risk",
            productName: "Analytics",
            stageName: null,
            leadName: "Bob Lead",
            description: "Project Analytics is flagged red.",
          },
        ],
      }),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.blockedAtRisk).toHaveLength(1);
    expect(result.blockedAtRisk[0]?.stage).toBe("Flagged");
  });

  it('renders "No stage set" for an escalation with a null stage', () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({
        escalations: [
          {
            type: "unresolved_risk",
            productName: "CRM Portal",
            stageName: null,
            leadName: "Alice Lead",
            description: "Legacy stage-less risk",
          },
        ],
      }),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.blockedAtRisk[0]?.stage).toBe("No stage set");
  });

  it("renders the resolved stage name when present", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport({
        escalations: [
          {
            type: "blocked",
            productName: "Analytics",
            stageName: "Development, Testing",
            leadName: "Bob Lead",
            description: "Multi-stage blocker",
          },
        ],
      }),
      now: new Date("2026-04-17T10:00:00.000Z"),
    });
    expect(result.blockedAtRisk[0]?.stage).toBe("Development, Testing");
  });

  it("flags isCurrentUser when currentUserId matches a lead row", () => {
    const result = mapDashboardData({
      review: makeReview(),
      weeklyReport: makeWeeklyReport(),
      now: new Date("2026-04-17T10:00:00.000Z"),
      currentUserId: LEAD_A,
    });
    const alice = result.leads.find((l) => l.id === LEAD_A);
    const bob = result.leads.find((l) => l.id === LEAD_B);
    expect(alice?.isCurrentUser).toBe(true);
    expect(bob?.isCurrentUser).toBe(false);
  });
});
