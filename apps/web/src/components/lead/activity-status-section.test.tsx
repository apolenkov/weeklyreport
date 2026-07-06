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
    alarmFloor: null,
    linkedProducts: [],
    ...overrides,
  };
}

const activities: LeadActivityCard[] = [
  makeCard({
    activityId: ACTIVITY_A,
    activityName: "Jira triage duty",
    status: "green",
    linkedProducts: [{ productId: "p1", productName: "CRM" }],
  }),
  makeCard({
    activityId: ACTIVITY_B,
    activityName: "Ops rotation",
    status: "red",
  }),
];

describe("ActivityStatusSection", () => {
  // route-activity-records-into-record-sections: the card is status-only —
  // records render in the main record sections under the activity's lane.
  it("renders one status-only card per activity with linked products", () => {
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
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.queryByText(/add/i)).toBeNull();
    // No record content leaks into the card.
    expect(screen.queryByText("Current")).toBeNull();
    expect(screen.queryByText("Risks & Blockers")).toBeNull();
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
    // Stored green but a covering blocker floors the pill to red (alarmFloor).
    render(
      <ActivityStatusSection
        activities={[
          makeCard({
            activityId: ACTIVITY_A,
            activityName: "Jira triage duty",
            status: "green",
            alarmFloor: "red",
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

  it("lets the lead lower a status they raised themselves (no covering risk)", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    // Stored red is the lead's OWN choice — no covering risk, so alarmFloor is
    // null and lowering must be allowed (the floor is not derivedStatus).
    render(
      <ActivityStatusSection
        activities={[
          makeCard({
            activityId: ACTIVITY_A,
            activityName: "Jira triage duty",
            status: "red",
            alarmFloor: null,
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
    const [onTrack] = Array.from(group.querySelectorAll("button"));
    await user.click(onTrack);
    expect(onStatusChange).toHaveBeenCalledWith(ACTIVITY_A, "green");
    expect(
      screen.queryByText(/resolve the covering risk\/blocker first/i),
    ).toBeNull();
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
