import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createDemoSection } from "../../../../test-utils/fixtures";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { buildHeadActivityRecords } from "../../model/head-activity-records";
import {
  ActivityRecordDetails,
  type ActivityReviewRow,
} from "./activity-record-details";

const AnchorRow: ActivityReviewRow = ({ anchor, children }) => (
  <div>
    <button type="button" aria-label={JSON.stringify(anchor)}>
      Review record
    </button>
    {children}
  </div>
);

describe("ActivityRecordDetails", () => {
  it("keeps every original record anchor outside Tab order until disclosure opens", async () => {
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const itemId = "11111111-1111-4111-8111-111111111111";
    const riskId = "22222222-2222-4222-8222-222222222222";
    const decisionId = "33333333-3333-4333-8333-333333333333";
    const section = makeReportSectionFixture({
      canReview: true,
      items: [
        {
          id: itemId,
          activityId,
          type: "current",
          text: "Work",
          tag: "delivery",
          workflowStatus: "paused",
          pausedReason: "Waiting",
          carriedOver: false,
          priorityRank: 1,
          nextStepText: "Follow up",
        },
      ],
      risks: [
        {
          id: riskId,
          activityId,
          risk: "Problem",
          severity: "blocked",
          impact: "Delay",
          mitigation: "Escalate",
        },
      ],
      decisions: [
        {
          id: decisionId,
          activityId,
          text: "Proceed",
          owner: "Ada",
          impact: "Delivery",
        },
      ],
    });
    const card = buildHeadActivityRecords([section])[0];
    if (!card) throw new Error("Missing Activity card");
    render(<ActivityRecordDetails card={card} Row={AnchorRow} />);
    const user = userEvent.setup();
    await user.tab();
    const disclosure = screen.getByRole("button", { name: /details for/ });
    expect(disclosure).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.keyboard("{Enter}");
    await user.tab();
    expect(
      screen.getByRole("button", { name: JSON.stringify({ itemId }) }),
    ).toHaveFocus();
    for (const anchor of [{ itemId }, { riskId }, { decisionId }])
      expect(
        screen.getByRole("button", { name: JSON.stringify(anchor) }),
      ).toBeInTheDocument();
    for (const text of [
      "Priority 1",
      "Paused",
      "Work",
      "Next commitment: Follow up",
      "Problem",
      "Delay",
      "Escalate",
      "Proceed",
    ])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("starts collapsed with true counts and reveals complete read-only records", async () => {
    const section = makeReportSectionFixture({
      ...createDemoSection(),
      activities: [],
      items: [],
      decisions: [],
      risks: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          risk: "Problem",
          impact: "Delay",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });
    const card = buildHeadActivityRecords([section])[0];
    if (!card) throw new Error("Missing activity fixture");
    render(<ActivityRecordDetails card={card} />);
    const disclosure = screen.getByRole("button", {
      name: /Activity details unavailable.*details.*Lead/i,
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveTextContent("Risks & Blockers 1");
    expect(screen.queryByText("Problem")).not.toBeInTheDocument();
    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    const regionId = disclosure.getAttribute("aria-controls");
    expect(regionId && document.getElementById(regionId)).toBeTruthy();
    for (const text of ["Problem", "Delay", "Escalate", "Blocked"])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(disclosure);
    expect(screen.queryByText("Problem")).not.toBeInTheDocument();
  });
});
