// @vitest-environment jsdom
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import { createDemoSection } from "../../../../test-utils/fixtures";
import { ActivityStatusStrip } from "./activity-status-strip";
import {
  ACTIVITY_ID_A,
  ACTIVITY_ID_B,
  sectionWithActivities,
} from "./activity-status-strip.test-support";

describe("ActivityStatusStrip — 1", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /details for/ }));
    const detachedGroup = screen
      .getByText("Activity details unavailable")
      .closest("li");
    expect(detachedGroup).toHaveTextContent("Detached Lead");
    expect(detachedGroup).toHaveTextContent("Detached current item");
    expect(detachedGroup).toHaveTextContent("Detached next item");
    expect(detachedGroup).toHaveTextContent("Detached blocker");
    expect(detachedGroup).toHaveTextContent("DecisionsDetached decision");
    expect(screen.queryByText("Current week draft item")).toBeNull();

    rerender(
      <ActivityStatusStrip sections={[detachedSection, otherSection]} />,
    );

    for (const button of screen.getAllByRole("button", {
      name: /details for/,
    })) {
      if (button.getAttribute("aria-expanded") === "false")
        fireEvent.click(button);
    }
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
    expect(other).toHaveTextContent("Other unmatched next item");
    expect(other).not.toHaveTextContent("Detached current item");
    expect(other).not.toHaveTextContent("Matched current item");
    for (const group of unavailableGroups) {
      expect(group).not.toHaveTextContent("Available duty");
      expect(group.querySelector("li > div:first-child")).not.toHaveTextContent(
        /On track|At risk|Blocked/,
      );
      expect(group).not.toHaveTextContent(ACTIVITY_ID_A);
      expect(group).not.toHaveTextContent(ACTIVITY_ID_B);
    }
    expect(screen.getAllByText("Available duty")).toHaveLength(1);
    expect(screen.getAllByText("Matched current item")).toHaveLength(1);
    const matched = screen.getByText("Available duty").closest("li");
    expect(matched).toHaveTextContent("On track");
    expect(matched).toHaveTextContent("Matched current item");
    expect(matched).not.toHaveTextContent("Detached current item");
    expect(screen.queryByText("Current week draft item")).toBeNull();
  });
});
describe("ActivityStatusStrip — 2", () => {
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
});
describe("ActivityStatusStrip — 3", () => {
  it("self-suppresses when no section carries an activity", () => {
    const { container } = render(
      <ActivityStatusStrip sections={[createDemoSection()]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
