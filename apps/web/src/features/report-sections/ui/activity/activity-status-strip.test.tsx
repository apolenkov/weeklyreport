import type { ReportSectionReadModel } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDemoSection } from "../../../../test-utils/fixtures";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../../test-utils/report-section-fixtures";
import { ActivityStatusStrip } from "./activity-status-strip";

const ACTIVITY_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sectionWithActivities(
  overrides: ReportSectionFixture,
): ReportSectionReadModel {
  return makeReportSectionFixture({ ...createDemoSection(), ...overrides });
}

describe("ActivityStatusStrip", () => {
  it("renders one row per (activity, author) with the status label", () => {
    const sections = [
      sectionWithActivities({
        authorName: "Иванов Василий Петрович",
        activities: [
          {
            activityId: ACTIVITY_ID_A,
            activityName: "Jira triage duty",
            status: "green",
            note: "Blocked on vendor",
            linkedProducts: [],
            derivedStatus: "red",
          },
        ],
      }),
      sectionWithActivities({
        reportSectionId: "99999999-9999-4999-8999-999999999999",
        authorId: "88888888-8888-4888-8888-888888888888",
        authorName: "Каштанова Мария Александровна",
        activities: [
          {
            activityId: ACTIVITY_ID_A,
            activityName: "Jira triage duty",
            status: "green",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
    ];

    render(<ActivityStatusStrip sections={sections} />);

    // The same activity appears once per reporting author — independent rows.
    expect(screen.getAllByText("Jira triage duty")).toHaveLength(2);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Иванов В.П.")).toBeInTheDocument();
    expect(screen.getByText("Каштанова М.А.")).toBeInTheDocument();
    expect(screen.queryByText("Иванов Василий Петрович")).toBeNull();
    expect(screen.getByText("Blocked on vendor")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Project Activities" }),
    ).toBeInTheDocument();
  });

  it("renders linked products and records only on their sorted activity-author card", () => {
    const sections = [
      sectionWithActivities({
        authorName: "Lead B",
        activities: [
          {
            activityId: ACTIVITY_ID_B,
            activityName: "Zulu duty",
            status: "green",
            linkedProducts: [],
            derivedStatus: null,
          },
          {
            activityId: ACTIVITY_ID_A,
            activityName: "Alpha duty",
            status: "green",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
        items: [
          {
            id: "11111111-1111-4111-8111-111111111112",
            activityId: ACTIVITY_ID_B,
            type: "next",
            text: "Lead B next item",
            tag: "delivery",
            workflowStatus: "planned",
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
      }),
      sectionWithActivities({
        reportSectionId: "99999999-9999-4999-8999-999999999999",
        authorId: "88888888-8888-4888-8888-888888888888",
        authorName: "Lead A",
        activities: [
          {
            activityId: ACTIVITY_ID_A,
            activityName: "Alpha duty",
            status: "yellow",
            linkedProducts: [
              {
                productId: "77777777-7777-4777-8777-777777777777",
                productName: "Payments",
              },
            ],
            derivedStatus: null,
          },
        ],
        items: [
          {
            id: "11111111-1111-4111-8111-111111111113",
            activityId: ACTIVITY_ID_A,
            type: "current",
            text: "Lead A current item",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
          {
            id: "11111111-1111-4111-8111-111111111114",
            activityId: ACTIVITY_ID_B,
            type: "current",
            text: "Wrong activity item",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
        ],
        risks: [
          {
            id: "22222222-2222-4222-8222-222222222221",
            activityId: ACTIVITY_ID_A,
            risk: "Lead A blocker",
            impact: "Delivery delay",
            mitigation: "Escalate",
            severity: "blocked",
            stageNames: [],
          },
        ],
        decisions: [
          {
            id: "33333333-3333-4333-8333-333333333331",
            activityId: ACTIVITY_ID_A,
            text: "Lead A decision",
            owner: "Lead A",
            impact: "Unblocks delivery",
            stageNames: [],
          },
        ],
      }),
    ];

    render(<ActivityStatusStrip sections={sections} />);

    const strip = screen.getByTestId("activity-status-strip");
    const cards = Array.from(
      strip.querySelector(":scope > ul")?.children ?? [],
    );
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Alpha dutyAt riskLead A.· Products: Payments"),
      expect.stringContaining("Alpha dutyOn trackLead B."),
      expect.stringContaining("Zulu dutyOn trackLead B."),
    ]);
    expect(cards[0]).toHaveTextContent("CurrentLead A current item");
    expect(cards[0]).toHaveTextContent("Risks & BlockersLead A blocker");
    expect(cards[0]).toHaveTextContent("DecisionsLead A decision");
    expect(cards[0]).not.toHaveTextContent("Wrong activity item");
    expect(cards[2]).toHaveTextContent("NextLead B next item");
    expect(cards[2]).not.toHaveTextContent("Lead A current item");
  });

  it("self-suppresses when no section carries an activity", () => {
    const { container } = render(
      <ActivityStatusStrip sections={[createDemoSection()]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
