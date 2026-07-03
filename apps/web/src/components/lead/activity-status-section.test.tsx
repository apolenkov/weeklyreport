import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LeadActivityCard } from "../../lib/mappers/lead-form";
import { ActivityStatusSection } from "./activity-status-section";

const ACTIVITY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeCard(overrides: Partial<LeadActivityCard>): LeadActivityCard {
  return {
    activityId: ACTIVITY_A,
    activityName: "Jira triage duty",
    status: "green",
    derivedStatus: null,
    linkedProducts: [],
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

const activities: LeadActivityCard[] = [
  makeCard({
    activityId: ACTIVITY_A,
    activityName: "Jira triage duty",
    status: "green",
    linkedProducts: [{ productId: "p1", productName: "CRM" }],
    currentItems: [
      {
        id: "i1",
        productId: "",
        productName: "Jira triage duty",
        activityId: ACTIVITY_A,
        status: "in-progress",
        text: "Triaged 12 tickets",
        author: "You",
        priorityRank: null,
      },
    ],
  }),
  makeCard({
    activityId: ACTIVITY_B,
    activityName: "Ops rotation",
    status: "red",
  }),
];

describe("ActivityStatusSection", () => {
  it("renders one card per activity with linked products and records", () => {
    render(
      <ActivityStatusSection
        activities={activities}
        readOnly={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("Ops rotation")).toBeInTheDocument();
    expect(screen.getByText("Products: CRM")).toBeInTheDocument();
    expect(screen.getByText("Triaged 12 tickets")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.queryByText(/add/i)).toBeNull();
  });

  it("renders nothing when the author has no attached activities", () => {
    const { container } = render(
      <ActivityStatusSection
        activities={[]}
        readOnly={false}
        onStatusChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current status pressed and reports a status change", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityStatusSection
        activities={activities}
        readOnly={false}
        onStatusChange={onStatusChange}
      />,
    );

    const groupA = screen.getByRole("group", {
      name: "Status for Jira triage duty",
    });
    const [onTrack, atRisk] = Array.from(groupA.querySelectorAll("button"));
    expect(onTrack).toHaveAttribute("aria-pressed", "true");

    await user.click(atRisk);
    expect(onStatusChange).toHaveBeenCalledWith(ACTIVITY_A, "yellow");
  });

  it("renders the floored pill and refuses a manual lower below the floor", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    // Stored green but a blocker floors the pill to red.
    render(
      <ActivityStatusSection
        activities={[
          makeCard({
            activityId: ACTIVITY_A,
            activityName: "Jira triage duty",
            status: "green",
            derivedStatus: "red",
          }),
        ]}
        readOnly={false}
        onStatusChange={onStatusChange}
      />,
    );

    const group = screen.getByRole("group", {
      name: "Status for Jira triage duty",
    });
    const [onTrack, , blocked] = Array.from(group.querySelectorAll("button"));
    // The floor (red) is shown pressed, not the stored green.
    expect(blocked).toHaveAttribute("aria-pressed", "true");
    expect(onTrack).toHaveAttribute("aria-pressed", "false");

    await user.click(onTrack);
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/resolve the covering risk\/blocker first/i),
    ).toBeInTheDocument();
  });

  it("disables every picker in read-only mode", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityStatusSection
        activities={activities}
        readOnly={true}
        onStatusChange={onStatusChange}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(
      true,
    );
    await user.click(buttons[0]);
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
