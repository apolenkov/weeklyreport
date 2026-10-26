// Lead read-only feedback surface — no composer (lead has no review capability).

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SectionReviewView } from "@weeklyreport/shared";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { LeadReviewFeedbackRecord } from "../../../report-sections";
import { mapLeadReviewFeedback } from "../../../report-sections";
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

function sectionWith(
  overrides: Parameters<typeof makeReportSectionFixture>[0],
) {
  return makeReportSectionFixture({
    projects: [
      { projectId: "p1", projectName: "Product Alpha", trafficLight: null },
    ],
    ...overrides,
  });
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
          stageNames: ["Development"],
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
          stageNames: ["Development"],
          comments: [],
        },
      ],
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
          stageNames: ["Development"],
          comments: [],
        },
      ],
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
      ],
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
          stageNames: [],
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
    render(<LeadReviewFeedback records={records} reviews={[]} />);

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

  const returned = (
    overrides: Partial<SectionReviewView> = {},
  ): SectionReviewView => ({
    reviewerId: REVIEWER_ID,
    reviewerName: "Head",
    verdict: "changes_requested",
    judgedVersion: 2,
    isCurrent: true,
    comment: "Add the missing risk owner.",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  });

  it("shows the current changes-requested reason even without record notes", () => {
    render(<LeadReviewFeedback records={[]} reviews={[returned()]} />);

    expect(screen.getByTestId("lead-review-feedback")).toBeInTheDocument();
    expect(screen.getByText("Add the missing risk owner.")).toBeInTheDocument();
    expect(screen.getByText(/Changes requested by Head/u)).toBeInTheDocument();
  });

  it("ignores stale, approved, and legacy reviews without a comment", () => {
    const { container } = render(
      <LeadReviewFeedback
        records={[]}
        reviews={[
          returned({ isCurrent: false }),
          returned({ verdict: "approved" }),
          returned({ comment: undefined }),
        ]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["item", "risk", "decision"] as const)(
    "links %s feedback to the actual record and reveals its collapsed container",
    async (kind) => {
      const user = userEvent.setup();
      const first = records[0];
      if (!first) throw new Error("Expected a feedback record");
      const record = { ...first, kind };
      const id = `review-record:${kind}:i1`;
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <LeadReviewFeedback records={[record]} reviews={[]} />
            <article>
              <button
                aria-expanded={open}
                aria-controls="record-panel"
                onClick={() => setOpen(!open)}
              >
                Show records
              </button>
              <div id="record-panel">
                <div hidden={!open} inert={!open}>
                  <div id={id} tabIndex={-1}>
                    Actual record
                  </div>
                </div>
              </div>
            </article>
          </>
        );
      }
      render(<Harness />);
      const link = screen.getByRole("link", { name: record.text });
      expect(link).toHaveAttribute("href", `#${id}`);
      await user.click(link);
      await waitFor(() => expect(document.getElementById(id)).toHaveFocus());
      expect(
        screen.getByRole("button", { name: "Show records" }),
      ).toHaveAttribute("aria-expanded", "true");
    },
  );

  it("cancels native anchor navigation when focusing an existing item", async () => {
    render(
      <>
        <LeadReviewFeedback records={records} reviews={[]} />
        <div id="review-record:item:i1" tabIndex={-1}>
          Actual record
        </div>
      </>,
    );
    const link = screen.getByRole("link", { name: "Ship the API" });
    expect(fireEvent.click(link)).toBe(false);
    await waitFor(() =>
      expect(document.getElementById("review-record:item:i1")).toHaveFocus(),
    );
  });

  it("does nothing when the item anchor is absent", async () => {
    render(<LeadReviewFeedback records={records} reviews={[]} />);
    const link = screen.getByRole("link", { name: "Ship the API" });
    const hash = window.location.hash;
    link.focus();
    expect(fireEvent.click(link)).toBe(false);
    await waitFor(() => expect(link).toHaveFocus());
    expect(window.location.hash).toBe(hash);
  });

  it("preserves modified link navigation without moving focus", () => {
    render(
      <>
        <LeadReviewFeedback records={records} reviews={[]} />
        <div id="review-record:item:i1" tabIndex={-1}>
          Actual record
        </div>
      </>,
    );
    const link = screen.getByRole("link", { name: "Ship the API" });
    link.focus();
    fireEvent.click(link, { ctrlKey: true });
    expect(link).toHaveFocus();
  });

  it("renders nothing when there is no feedback", () => {
    const { container } = render(
      <LeadReviewFeedback records={[]} reviews={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
