import { render, screen, within } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
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
        authorName: "Кузнецова Мария Александровна",
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
    expect(screen.getByText("Кузнецова М.А.")).toBeInTheDocument();
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

    const strip = screen.getByTestId("activity-status-strip");
    const cards = Array.from(
      strip.querySelector(":scope > ul")?.children ?? [],
    );
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Alpha dutyAt riskLead A.Products: Payments"),
      expect.stringContaining("Alpha dutyOn trackLead B."),
      expect.stringContaining("Zulu dutyOn trackLead B."),
    ]);
    expect(cards[0]).toHaveTextContent("CurrentLead A current item");
    expect(cards[0]).toHaveTextContent("Risks & BlockersLead A blocker");
    expect(cards[0]).toHaveTextContent("DecisionsLead A decision");
    expect(cards[0]).not.toHaveTextContent("Product-only item");
    expect(cards[2]).toHaveTextContent("NextLead B next item");
    expect(cards[2]).not.toHaveTextContent("Lead A current item");
  });

  it("preserves saved records with unavailable activity details in a separate group per author", () => {
    const detachedSection = sectionWithActivities({
      authorName: "Detached Lead",
      activities: [],
      items: [
        ...(
          [
            ["current", "11111111-1111-4111-8111-111111111121"],
            ["next", "11111111-1111-4111-8111-111111111122"],
          ] as const
        ).map(([type, id]) => ({
          id,
          activityId: ACTIVITY_ID_A,
          type,
          text: `Detached ${type} item`,
          tag: "delivery",
          workflowStatus: "planned" as const,
          carriedOver: false,
        })),
        ...createDemoSection().items,
      ],
      risks: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          activityId: ACTIVITY_ID_B,
          risk: "Detached blocker",
          impact: "Delivery delay",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: [],
        },
      ],
      decisions: [
        {
          id: "33333333-3333-4333-8333-333333333332",
          activityId: ACTIVITY_ID_B,
          text: "Detached decision",
          owner: "Detached Lead",
          impact: "Unblocks delivery",
          stageNames: [],
        },
      ],
    });
    const otherSection = sectionWithActivities({
      reportSectionId: "99999999-9999-4999-8999-999999999999",
      authorId: "88888888-8888-4888-8888-888888888888",
      authorName: "Other Lead",
      activities: [
        {
          activityId: ACTIVITY_ID_A,
          activityName: "Available duty",
          status: "green",
        },
      ],
      items: [
        {
          id: "11111111-1111-4111-8111-111111111123",
          activityId: ACTIVITY_ID_A,
          type: "current",
          text: "Matched current item",
          tag: "delivery",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
        {
          id: "11111111-1111-4111-8111-111111111124",
          activityId: ACTIVITY_ID_B,
          type: "next",
          text: "Other unmatched next item",
          tag: "delivery",
          workflowStatus: "planned",
          carriedOver: false,
        },
      ],
      risks: [],
      decisions: [],
    });

    const { rerender } = render(
      <ActivityStatusStrip sections={[detachedSection]} />,
    );

    const detachedGroup = screen
      .getByText("Activity details unavailable")
      .closest("li");
    expect(detachedGroup).toHaveTextContent("Detached Lead");
    expect(detachedGroup).toHaveTextContent("CurrentDetached current item");
    expect(detachedGroup).toHaveTextContent("NextDetached next item");
    expect(detachedGroup).toHaveTextContent("Risks & BlockersDetached blocker");
    expect(detachedGroup).toHaveTextContent("DecisionsDetached decision");
    expect(screen.queryByText("Current week draft item")).toBeNull();

    rerender(
      <ActivityStatusStrip sections={[detachedSection, otherSection]} />,
    );

    const unavailableGroups = screen
      .getAllByText("Activity details unavailable")
      .map((label) => expectDefined(label.closest("li")));
    expect(unavailableGroups).toHaveLength(2);
    const detached = expectDefined(
      unavailableGroups.find((group) =>
        within(group).queryByText("Detached Lead"),
      ),
    );
    const other = expectDefined(
      unavailableGroups.find((group) =>
        within(group).queryByText("Other Lead"),
      ),
    );
    expect(detached).toHaveTextContent("Detached current item");
    expect(detached).toHaveTextContent("Detached next item");
    expect(detached).toHaveTextContent("Detached blocker");
    expect(detached).toHaveTextContent("Detached decision");
    expect(detached).not.toHaveTextContent("Other unmatched next item");
    expect(other).toHaveTextContent("NextOther unmatched next item");
    expect(other).not.toHaveTextContent("Detached current item");
    expect(other).not.toHaveTextContent("Matched current item");
    for (const group of unavailableGroups) {
      expect(group).not.toHaveTextContent("Available duty");
      expect(group).not.toHaveTextContent(/On track|At risk|Blocked/);
      expect(group).not.toHaveTextContent(ACTIVITY_ID_A);
      expect(group).not.toHaveTextContent(ACTIVITY_ID_B);
    }
    expect(screen.getAllByText("Available duty")).toHaveLength(1);
    expect(screen.getAllByText("Matched current item")).toHaveLength(1);
    const matched = screen.getByText("Available duty").closest("li");
    expect(matched).toHaveTextContent("On track");
    expect(matched).toHaveTextContent("CurrentMatched current item");
    expect(matched).not.toHaveTextContent("Detached current item");
    expect(screen.queryByText("Current week draft item")).toBeNull();
  });

  it("puts the status dot in its own column and keeps the status label sentence-case (R06/R23)", () => {
    render(
      <ActivityStatusStrip
        sections={[
          sectionWithActivities({
            activities: [
              {
                activityId: ACTIVITY_ID_A,
                activityName:
                  "Long running incident duty rotation for the holiday week",
                status: "yellow",
                linkedProducts: [{ productId: "p1", productName: "Payments" }],
                derivedStatus: null,
              },
            ],
          }),
        ]}
      />,
    );
    const label = screen.getByText("At risk");
    expect(label.className).not.toContain("uppercase");
    const grid = label.closest("li")?.firstElementChild;
    expect(grid).toHaveClass("grid");
    expect(grid?.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(/^Products: Payments$/).textContent).not.toContain(
      "·",
    );
  });

  it("self-suppresses when no section carries an activity", () => {
    const { container } = render(
      <ActivityStatusStrip sections={[createDemoSection()]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
