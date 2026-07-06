/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityLanesBlock } from "./activity-lanes-block";
import type { KanbanItem } from "./mock-data";
import type { ItemColumn } from "./next-week-columns";

function laneItem(id: string): KanbanItem {
  return {
    id,
    productId: "",
    productName: "Jira triage duty",
    activityId: "act-a",
    activityName: "Jira triage duty",
    status: "in-progress",
    text: `row ${id}`,
    author: "Тимлид 1",
  };
}

const LANE: ItemColumn = {
  key: "activity:act-a",
  productId: "",
  productName: "Jira triage duty",
  activityId: "act-a",
  items: [laneItem("a1"), laneItem("a2")],
};

describe("ActivityLanesBlock", () => {
  it("renders the kicker, lane header, injected items, and an activity-seeded + Add", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityLanesBlock
        lanes={[LANE]}
        readOnly={false}
        onAdd={onAdd}
        renderItem={(item) => <div key={item.id}>{item.text}</div>}
      />,
    );

    expect(screen.getByText("Activities")).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("row a1")).toBeInTheDocument();
    expect(screen.getByText("row a2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add item to Jira triage duty" }),
    );
    expect(onAdd).toHaveBeenCalledWith({ activityId: "act-a" });
  });

  it("self-suppresses when there are no lanes", () => {
    const { container } = render(
      <ActivityLanesBlock
        lanes={[]}
        readOnly={false}
        onAdd={vi.fn()}
        renderItem={() => null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("read-only renders lanes without any + Add", () => {
    render(
      <ActivityLanesBlock
        lanes={[LANE]}
        readOnly={true}
        onAdd={vi.fn()}
        renderItem={(item) => <div key={item.id}>{item.text}</div>}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("row a1")).toBeInTheDocument();
  });
});
