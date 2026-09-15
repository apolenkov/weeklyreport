import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import {
  mapLeadDecisions,
  mapLeadItems,
  mapLeadPriorities,
  mapLeadProducts,
  mapLeadReviewFeedback,
  mapLeadRisks,
} from "./lead-form";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_A = "44444444-4444-4444-8444-444444444444";
const PROJECT_B = "55555555-5555-4555-8555-555555555555";
const ACTIVITY_A = "77777777-7777-4777-8777-777777777777";

const activityA = {
  activityId: ACTIVITY_A,
  activityName: "Jira triage duty",
  status: "green" as const,
  linkedProducts: [],
  derivedStatus: null,
};

function baseSection(
  overrides: ReportSectionFixture = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Тимлид 1",
    ...overrides,
  });
}

describe("mapLeadItems", () => {
  it("returns 'in-progress' for a current-type item with workflowStatus='in_progress'", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      items: [
        {
          id: "item-1",
          stableId: "stable-item-1",
          projectId: PROJECT_A,
          type: "current",
          text: "Wire OAuth2 callback",
          tag: "auth",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const mapped = mapLeadItems(section, "current").at(0);
    expect(mapped?.status).toBe("in-progress");
    expect(mapped?.stableId).toBe("stable-item-1");
    expect(mapped?.tag).toBe("auth");
    expect(mapped?.text).toBe("Wire OAuth2 callback");
    expect(mapped?.productName).toBe("CRM");
    expect(mapped?.author).toBe("Тимлид 1");
  });

  it("filters items by 'next' type and resolves project name", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
        { projectId: PROJECT_B, projectName: "Mobile", trafficLight: "yellow" },
      ],
      items: [
        {
          id: "i1",
          projectId: PROJECT_A,
          type: "current",
          text: "this week",
          tag: "a",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
        {
          id: "i2",
          projectId: PROJECT_B,
          type: "next",
          text: "next week",
          tag: "b",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const next = mapLeadItems(section, "next");
    expect(next).toHaveLength(1);
    expect(expectDefined(next[0]).text).toBe("next week");
    expect(expectDefined(next[0]).productName).toBe("Mobile");
  });

  it('falls back to "Unknown" product name when projectId is unmapped', () => {
    const section = baseSection({
      items: [
        {
          id: "orphan",
          projectId: "99999999-9999-4999-8999-999999999999",
          type: "current",
          text: "orphan item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const mapped = mapLeadItems(section, "current").at(0);
    expect(mapped?.productName).toBe("Unknown");
  });

  // Activity-parented rows render in the main sections under an activity
  // lane, no longer only in the card.
  it("includes an activity-parented item with the activity as its display parent", () => {
    const section = baseSection({
      activities: [activityA],
      items: [
        {
          id: "act-item-1",
          projectId: null,
          activityId: ACTIVITY_A,
          type: "current",
          text: "Triage the incoming queue",
          tag: "ops",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const mapped = mapLeadItems(section, "current");
    expect(mapped).toHaveLength(1);
    const item = expectDefined(mapped[0]);
    expect(item.activityId).toBe(ACTIVITY_A);
    expect(item.activityName).toBe("Jira triage duty");
    expect(item.parent).toEqual({ kind: "activity", id: ACTIVITY_A });
    expect(item.productId).toBeNull();
    expect(item.productName).toBe("Jira triage duty");
  });
});

describe("mapLeadRisks / mapLeadDecisions / mapLeadPriorities", () => {
  it("exposes risk + impact + mitigation as separate fields and resolves productName", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "yellow" },
      ],
      risks: [
        {
          id: "r1",
          projectId: PROJECT_A,
          risk: "OAuth delay",
          impact: "SSO slips",
          mitigation: "Escalate vendor",
          severity: "blocked",
        },
      ],
    });

    const mapped = mapLeadRisks(section).at(0);
    expect(mapped?.productName).toBe("CRM");
    expect(mapped?.severity).toBe("blocked");
    // `text` holds raw `risk` only; impact/mitigation surface as
    // separate fields in the edit dialog (avoids double-concat on save).
    expect(mapped?.text).toBe("OAuth delay");
    expect(mapped?.impact).toBe("SSO slips");
    expect(mapped?.mitigation).toBe("Escalate vendor");
  });

  it("passes decisions through with department-scope productName", () => {
    const section = baseSection({
      decisions: [
        {
          id: "d1",
          stableId: "88888888-8888-4888-8888-888888888888",
          text: "Approve Redis cluster",
          owner: "Head",
          impact: "Caching",
        },
      ],
    });

    const mapped = mapLeadDecisions(section).at(0);
    expect(mapped?.id).toBe("d1");
    expect(mapped?.stableId).toBe("88888888-8888-4888-8888-888888888888");
    expect(mapped?.text).toBe("Approve Redis cluster");
    expect(mapped?.productName).toBe("Unknown");
  });

  // Activity risks/decisions surface in the main sections labeled with the
  // activity name.
  it("includes an activity-parented risk labeled with the activity name", () => {
    const section = baseSection({
      activities: [activityA],
      risks: [
        {
          id: "act-risk-1",
          projectId: null,
          activityId: ACTIVITY_A,
          risk: "Rotation understaffed",
          impact: "Queue grows",
          mitigation: "Borrow one dev",
          severity: "at-risk",
        },
      ],
    });

    const mapped = mapLeadRisks(section);
    expect(mapped).toHaveLength(1);
    const risk = expectDefined(mapped[0]);
    expect(risk.activityId).toBe(ACTIVITY_A);
    expect(risk.productId).toBe("");
    expect(risk.productName).toBe("Jira triage duty");
    expect(risk.text).toBe("Rotation understaffed");
  });

  it("fails loud on a risk without an id", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "yellow" },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Corrupt risk",
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "at-risk",
          stageNames: ["Planning"],
        },
      ],
    });

    expect(() => mapLeadRisks(section)).toThrow(/missing id/);
  });

  it("includes an activity-parented decision labeled with the activity name", () => {
    const section = baseSection({
      activities: [activityA],
      decisions: [
        {
          id: "act-dec-1",
          activityId: ACTIVITY_A,
          text: "Keep the rotation weekly",
          owner: "Тимлид 1",
          impact: "Predictable load",
        },
      ],
    });

    const mapped = mapLeadDecisions(section);
    expect(mapped).toHaveLength(1);
    const decision = expectDefined(mapped[0]);
    expect(decision.activityId).toBe(ACTIVITY_A);
    expect(decision.productId).toBe("");
    expect(decision.productName).toBe("Jira triage duty");
  });

  it("uses the effective weekly Activity title for every record-family index", () => {
    const section = baseSection({
      activities: [
        {
          ...activityA,
          titleOverride: "Weekly triage",
        },
      ],
      items: [
        {
          id: "act-item-title",
          activityId: ACTIVITY_A,
          projectId: null,
          type: "current",
          text: "Triage queue",
          tag: "ops",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
      risks: [
        {
          id: "act-risk-title",
          activityId: ACTIVITY_A,
          projectId: null,
          risk: "Queue risk",
          impact: "Delay",
          mitigation: "Staff backup",
          severity: "at-risk",
        },
      ],
      decisions: [
        {
          id: "act-decision-title",
          activityId: ACTIVITY_A,
          text: "Keep triage weekly",
          owner: "Тимлид 1",
          impact: "Stable response",
        },
      ],
    });

    expect(mapLeadItems(section, "current")[0]?.activityName).toBe(
      "Weekly triage",
    );
    expect(mapLeadRisks(section)[0]?.productName).toBe("Weekly triage");
    expect(mapLeadDecisions(section)[0]?.productName).toBe("Weekly triage");
  });

  it("derives priorities from positive integer ranks, sorted by rank", () => {
    const section = baseSection({
      items: [
        {
          id: "i1",
          projectId: PROJECT_A,
          type: "current",
          text: "P1",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 1,
        },
        {
          id: "i2",
          projectId: PROJECT_A,
          type: "current",
          text: "P5",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 5,
        },
        {
          id: "i3",
          projectId: PROJECT_A,
          type: "current",
          text: "invalid-zero",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 0,
        },
      ],
    });

    const mapped = mapLeadPriorities(section);
    expect(expectDefined(mapped[0]).rank).toBe(1);
    // Variable-length list keeps rank as-is when ≥ 1.
    expect(expectDefined(mapped[1]).rank).toBe(5);
    expect(expectDefined(mapped[1]).text).toBe("P5");
    expect(mapped).toHaveLength(2);
  });
});

describe("mapLeadReviewFeedback", () => {
  it("drops items/risks/decisions with no comments and keeps ones that carry ≥1", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      items: [
        {
          id: "i-commented",
          projectId: PROJECT_A,
          type: "current",
          text: "Commented item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
          comments: [
            {
              id: "c1",
              reviewerId: "reviewer-1",
              reviewerName: "Head",
              text: "Looks good",
              createdAt: new Date("2026-04-20T12:00:00Z"),
            },
          ],
        },
        {
          id: "i-silent",
          projectId: PROJECT_A,
          type: "current",
          text: "Silent item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const feedback = mapLeadReviewFeedback(section);

    expect(feedback).toHaveLength(1);
    expect(expectDefined(feedback[0]).id).toBe("i-commented");
    expect(expectDefined(feedback[0]).kind).toBe("item");
    expect(expectDefined(feedback[0]).text).toBe("Commented item");
    expect(expectDefined(feedback[0]).productName).toBe("CRM");
    expect(expectDefined(feedback[0]).comments).toHaveLength(1);
  });

  it("falls back to id '' when the record carries no id", () => {
    const section = baseSection({
      risks: [
        {
          risk: "Vendor delay",
          impact: "Slip",
          mitigation: "Escalate",
          severity: "at-risk",
          comments: [
            {
              id: "c1",
              reviewerId: "reviewer-1",
              reviewerName: "Head",
              text: "Noted",
              createdAt: new Date("2026-04-20T12:00:00Z"),
            },
          ],
        },
      ],
    });

    const feedback = mapLeadReviewFeedback(section);
    expect(expectDefined(feedback[0]).id).toBe("");
    expect(expectDefined(feedback[0]).kind).toBe("risk");
    expect(expectDefined(feedback[0]).text).toBe("Vendor delay");
  });

  it("resolves an activity-parented decision's label from the activity name", () => {
    const section = baseSection({
      activities: [activityA],
      decisions: [
        {
          id: "d1",
          activityId: ACTIVITY_A,
          text: "Keep rotation weekly",
          owner: "Тимлид 1",
          impact: "Predictable load",
          comments: [
            {
              id: "c1",
              reviewerId: "reviewer-1",
              reviewerName: "Head",
              text: "Ack",
              createdAt: new Date("2026-04-20T12:00:00Z"),
            },
          ],
        },
      ],
    });

    const feedback = mapLeadReviewFeedback(section);
    expect(expectDefined(feedback[0]).kind).toBe("decision");
    expect(expectDefined(feedback[0]).productName).toBe("Jira triage duty");
  });

  it("resolves 'Unknown' for a decision with neither productId nor activityId", () => {
    const section = baseSection({
      decisions: [
        {
          id: "d1",
          text: "Orphaned decision",
          owner: "Head",
          impact: "Impact",
          comments: [
            {
              id: "c1",
              reviewerId: "reviewer-1",
              reviewerName: "Head",
              text: "Ack",
              createdAt: new Date("2026-04-20T12:00:00Z"),
            },
          ],
        },
      ],
    });

    const feedback = mapLeadReviewFeedback(section);
    expect(expectDefined(feedback[0]).productName).toBe("Unknown");
  });

  it("returns an empty array when nothing on the section carries comments", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      items: [
        {
          id: "i1",
          projectId: PROJECT_A,
          type: "current",
          text: "No feedback yet",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    expect(mapLeadReviewFeedback(section)).toEqual([]);
  });
});

// Cards for projects the author owns no stage on resolve names from
// `referencedProjects`, never the placeholder (only truly unknown ids keep it).
describe("report-wide name resolution (referencedProjects)", () => {
  const FOREIGN_PROJECT = "66666666-6666-4666-8666-666666666666";
  const TRULY_UNKNOWN = "99999999-9999-4999-8999-999999999999";

  function crossStageSection(
    overrides: Partial<ReportSectionReadModel> = {},
  ): ReportSectionReadModel {
    return baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      referencedProjects: [
        { projectId: FOREIGN_PROJECT, projectName: "Payments Gateway" },
      ],
      ...overrides,
    });
  }

  it("resolves a risk's product name from referencedProjects when the author owns no stage on it", () => {
    const section = crossStageSection({
      risks: [
        {
          id: "r1",
          projectId: FOREIGN_PROJECT,
          risk: "Cross-stage risk",
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "at-risk",
          stageNames: ["Planning"],
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("Payments Gateway");
  });

  it("resolves a decision's product name from referencedProjects instead of 'Group'", () => {
    const section = crossStageSection({
      decisions: [
        {
          id: "d1",
          text: "Cross-stage decision",
          owner: "Owner",
          impact: "Impact",
          productId: FOREIGN_PROJECT,
          stageNames: ["Planning"],
        },
      ],
    });

    expect(mapLeadDecisions(section).at(0)?.productName).toBe(
      "Payments Gateway",
    );
  });

  it("resolves item and priority product names from referencedProjects", () => {
    const section = crossStageSection({
      items: [
        {
          id: "i1",
          projectId: FOREIGN_PROJECT,
          type: "current",
          text: "Cross-stage item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 1,
          stageNames: ["Planning"],
        },
      ],
    });

    expect(mapLeadItems(section, "current").at(0)?.productName).toBe(
      "Payments Gateway",
    );
    expect(mapLeadPriorities(section).at(0)?.productName).toBe(
      "Payments Gateway",
    );
  });

  it("keeps the placeholder for an id the entire name source cannot resolve", () => {
    const section = crossStageSection({
      risks: [
        {
          id: "r1",
          projectId: TRULY_UNKNOWN,
          risk: "Foreign risk",
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "at-risk",
          stageNames: ["Planning"],
        },
      ],
      decisions: [
        {
          id: "d1",
          text: "Foreign decision",
          owner: "Owner",
          impact: "Impact",
          productId: TRULY_UNKNOWN,
          stageNames: ["Planning"],
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("Unknown");
    expect(mapLeadDecisions(section).at(0)?.productName).toBe("Group");
  });

  it("prefers the stage-owned entry when the same id is also referenced", () => {
    const section = crossStageSection({
      referencedProjects: [{ projectId: PROJECT_A, projectName: "Stale Copy" }],
      risks: [
        {
          id: "r1",
          projectId: PROJECT_A,
          risk: "Owned-project risk",
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "at-risk",
          stageNames: ["Planning"],
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("CRM");
  });

  it("does not add a stray product card for a referenced-only project", () => {
    const section = crossStageSection();
    const products = mapLeadProducts(section);

    expect(products).toHaveLength(1);
    expect(products.at(0)?.id).toBe(PROJECT_A);
  });
});
