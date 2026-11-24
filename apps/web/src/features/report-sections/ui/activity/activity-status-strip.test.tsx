// @vitest-environment jsdom
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityStatusStrip } from "./activity-status-strip";
import {
  ACTIVITY_ID_A,
  ACTIVITY_ID_B,
  sectionWithActivities,
} from "./activity-status-strip.test-support";

describe("ActivityStatusStrip — 1", () => {
  it("renders one row per (activity, author) with the status label", () => {
    const sections = [
      sectionWithActivities({
        authorName: "Ильин Василий Петрович",
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
    expect(screen.getByText("Ильин В.П.")).toBeInTheDocument();
    expect(screen.getByText("Каштанова М.А.")).toBeInTheDocument();
    expect(screen.queryByText("Ильин Василий Петрович")).toBeNull();
    expect(screen.getByText("Blocked on vendor")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Project Activities" }),
    ).toBeInTheDocument();
  });
});
describe("ActivityStatusStrip — 2", () => {
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
            projectId: "77777777-7777-4777-8777-777777777777",
            type: "current",
            text: "Product-only item",
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

    expect(screen.queryByText("Lead A current item")).toBeNull();
    for (const button of screen.getAllByRole("button", { name: /details for/ }))
      fireEvent.click(button);
    const strip = screen.getByTestId("activity-status-strip");
    const cards = Array.from(
      strip.querySelector(":scope > ul")?.children ?? [],
    );
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Alpha dutyAt riskLead A.Products: Payments"),
      expect.stringContaining("Alpha dutyOn trackLead B."),
      expect.stringContaining("Zulu dutyOn trackLead B."),
    ]);
    expect(cards[0]).toHaveTextContent("Lead A current item");
    expect(cards[0]).toHaveTextContent("Lead A blocker");
    expect(cards[0]).toHaveTextContent("DecisionsLead A decision");
    expect(cards[0]).not.toHaveTextContent("Product-only item");
    expect(cards[2]).toHaveTextContent("Lead B next item");
    expect(cards[2]).not.toHaveTextContent("Lead A current item");
  });
});
