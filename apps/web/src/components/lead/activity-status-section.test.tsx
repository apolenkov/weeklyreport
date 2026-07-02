import type { SectionActivity } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityStatusSection } from "./activity-status-section";

const ACTIVITY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const activities: SectionActivity[] = [
  { activityId: ACTIVITY_A, activityName: "Jira triage duty", status: "green" },
  { activityId: ACTIVITY_B, activityName: "Ops rotation", status: "red" },
];

describe("ActivityStatusSection", () => {
  it("lists ONLY the seeded (attached) activities — no add affordance", () => {
    render(
      <ActivityStatusSection
        activities={activities}
        readOnly={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("Ops rotation")).toBeInTheDocument();
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
