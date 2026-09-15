// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { TrackedWorkComments } from "./status-overview-record-comments";

const RECORD_ID = "11111111-1111-4111-8111-111111111111";

function makeItem(
  overrides: Partial<StatusOverviewItem> = {},
): StatusOverviewItem {
  return {
    key: "current:item-1",
    recordId: RECORD_ID,
    source: "current",
    editTarget: { recordId: RECORD_ID, source: "current" },
    stableId: "22222222-2222-4222-8222-222222222222",
    text: "Ship the feature",
    tag: "feature",
    stageNames: [],
    pausedReason: null,
    resolution: null,
    outcomeHistory: [],
    comments: [],
    canResolve: false,
    canRestore: false,
    workflowStatus: "in_progress",
    continuity: "continued",
    ...overrides,
  };
}

const COMMENT = {
  id: "30000000-0000-4000-8000-000000000001",
  reviewerId: "10000000-0000-4000-8000-000000000002",
  reviewerName: "Head",
  text: "Please clarify the rollout",
  createdAt: new Date("2026-09-10T09:00:00.000Z"),
};

describe("TrackedWorkComments", () => {
  it("shows the scoped reviewer comments on the record", () => {
    render(<TrackedWorkComments item={makeItem({ comments: [COMMENT] })} />);

    expect(screen.getByText("Reviewer comments")).toBeInTheDocument();
    expect(screen.getByText("Please clarify the rollout")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviewer comments")).toBeInTheDocument();
  });

  it("self-suppresses when the record carries no comments", () => {
    render(<TrackedWorkComments item={makeItem()} />);

    expect(screen.queryByText("Reviewer comments")).toBeNull();
  });

  it("stays read-only: the lead surface offers no composer", () => {
    render(<TrackedWorkComments item={makeItem({ comments: [COMMENT] })} />);

    expect(screen.queryByLabelText("Add a review comment")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders comments for a projected record without an edit target", () => {
    render(
      <TrackedWorkComments
        item={makeItem({ editTarget: null, comments: [COMMENT] })}
      />,
    );

    expect(screen.getByText("Please clarify the rollout")).toBeInTheDocument();
  });
});
