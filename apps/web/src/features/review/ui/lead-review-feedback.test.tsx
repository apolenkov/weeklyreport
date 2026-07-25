// Lead read-only feedback surface — no composer (lead has no review capability).

import type { ReportSectionReadModel } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LeadReviewFeedbackRecord } from "../../report-sections";
import { mapLeadReviewFeedback } from "../../report-sections";
import { LeadReviewFeedback } from "./lead-review-feedback";

const REVIEWER_ID = "99999999-9999-4999-8999-999999999999";

function comment(id: string, text: string) {
  return {
    id,
    reviewerId: REVIEWER_ID,
    reviewerName: "Head",
    text,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };
}

// Fixture must include activities: [] so the mapper can label activity-parented rows.
function sectionWith(
  overrides: Partial<
    Pick<
      ReportSectionReadModel,
      "projects" | "items" | "risks" | "decisions" | "activities"
    >
  >,
): ReportSectionReadModel {
  return {
    projects: [
      { projectId: "p1", projectName: "Product Alpha", trafficLight: null },
    ],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    ...overrides,
  } as unknown as ReportSectionReadModel;
}

describe("mapLeadReviewFeedback", () => {
  it("keeps only records that carry reviewer comments, resolving the product name", () => {
    const section = sectionWith({
      items: [
        {
          id: "i1",
          projectId: "p1",
          type: "current",
          text: "Ship the API",
          tag: "Dev",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageIds: ["Development"],
          comments: [comment("c1", "Add error handling")],
        },
        {
          id: "i2",
          projectId: "p1",
          type: "current",
          text: "No feedback here",
          tag: "Dev",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageIds: ["Development"],
          comments: [],
        },
      ] as unknown as ReportSectionReadModel["items"],
    });

    const result = mapLeadReviewFeedback(section);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "i1",
      kind: "item",
      productName: "Product Alpha",
      text: "Ship the API",
    });
    expect(result[0]?.comments).toHaveLength(1);
  });

  it("returns an empty list when no record carries a comment", () => {
    const section = sectionWith({
      risks: [
        {
          id: "r1",
          projectId: "p1",
          risk: "Vendor delay",
          impact: "x",
          mitigation: "y",
          severity: "at-risk",
          stageIds: ["Development"],
          comments: [],
        },
      ] as unknown as ReportSectionReadModel["risks"],
    });

    expect(mapLeadReviewFeedback(section)).toEqual([]);
  });

  it("labels an activity-parented record with the activity name, not 'Unknown'", () => {
    const section = sectionWith({
      activities: [
        {
          activityId: "act-1",
          activityName: "Jira triage duty",
          status: "green",
          derivedStatus: "green",
          note: null,
          linkedProducts: [],
        },
      ] as unknown as ReportSectionReadModel["activities"],
      decisions: [
        {
          id: "d1",
          productId: null,
          activityId: "act-1",
          text: "Escalate the backlog",
          owner: "Lead",
          impact: "x",
          deadline: null,
          resolvedAt: null,
          stageIds: [],
          comments: [comment("c1", "Confirm scope")],
        },
      ],
    });

    const result = mapLeadReviewFeedback(section);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "d1",
      kind: "decision",
      productName: "Jira triage duty",
      text: "Escalate the backlog",
    });
  });
});

describe("LeadReviewFeedback", () => {
  const records: LeadReviewFeedbackRecord[] = [
    {
      id: "i1",
      kind: "item",
      productName: "Product Alpha",
      text: "Ship the API",
      comments: [
        comment("c1", "Add error handling"),
        comment("c2", "And tests"),
      ],
    },
  ];

  it("renders the section-level marker and each comment inline on its record", () => {
    render(<LeadReviewFeedback records={records} />);

    expect(screen.getByTestId("lead-review-feedback")).toBeInTheDocument();
    // Section-level count marker so the return is not silent. Verdict-neutral
    // copy: comments can predate any verdict, so the marker must not assert a
    // resubmission was requested.
    expect(
      screen.getByText(/2 reviewer notes on your records/i),
    ).toBeInTheDocument();
    // The record's own text is shown as context (not re-rendered as a comment).
    expect(screen.getByText("Ship the API")).toBeInTheDocument();
    // The reviewer comments render via the shared list.
    expect(screen.getByText("Add error handling")).toBeInTheDocument();
    expect(screen.getByText("And tests")).toBeInTheDocument();
    expect(screen.getAllByText("Head").length).toBeGreaterThan(0);
    // Strictly read-only: no composer for the lead.
    expect(
      screen.queryByRole("textbox", { name: /review comment/i }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no feedback", () => {
    const { container } = render(<LeadReviewFeedback records={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
