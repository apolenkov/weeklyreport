// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { focusReviewRecord } from "../../../shared/ui/feedback/review-record-focus";
import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const item: StatusOverviewItem = {
  key: "current:one",
  recordId: "one",
  source: "current",
  editTarget: { recordId: "one", source: "current" },
  stableId: "one",
  text: "First item",
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
};
const comment = {
  id: "comment-one",
  reviewerId: "reviewer",
  reviewerName: "Head",
  text: "First item feedback",
  createdAt: new Date("2026-09-10T09:00:00Z"),
};

it("opens the empty comments region and returns focus on close", async () => {
  const user = userEvent.setup();
  render(<StatusOverviewItemPreview item={item} />);
  await user.click(screen.getByRole("button", { name: /View text/ }));
  const opener = screen.getByRole("button", { name: "Discussion (0)" });
  opener.focus();
  await user.keyboard("{Enter}");
  const region = screen.getByRole("region", {
    name: "Comments for First item",
  });
  expect(within(region).getByText("No comments yet.")).toBeVisible();
  await user.click(
    within(region).getByRole("button", { name: "Close comments" }),
  );
  expect(
    screen.queryByRole("region", { name: "Comments for First item" }),
  ).toBeNull();
  expect(opener).toHaveFocus();
});

it("lets keyboard users reach close after opening and restores focus", async () => {
  const user = userEvent.setup();
  render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  const opener = screen.getByRole("button", {
    name: "Discussion: First item, 1 comments",
  });
  opener.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", { name: "Discussion" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Close comments" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(opener).toHaveFocus();
});

it("does not carry an open region to a different item in a reused card", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Discussion: First item, 1 comments" }),
  );
  const second = {
    ...item,
    comments: [comment],
    key: "current:two",
    recordId: "two",
    stableId: "two",
    text: "Second item",
    editTarget: { recordId: "two", source: "current" as const },
  };
  rerender(<StatusOverviewItemPreview item={second} onEditItem={vi.fn()} />);
  expect(
    screen.queryByRole("region", { name: "Comments for Second item" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Discussion: Second item, 1 comments" }),
  ).toHaveAttribute("aria-expanded", "false");
  rerender(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Comments for First item" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Discussion: First item, 1 comments" }),
  ).toHaveAttribute("aria-expanded", "false");
});

it("uses a plain read-comment icon, not an add-comment icon", () => {
  render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  const opener = screen.getByRole("button", {
    name: "Discussion: First item, 1 comments",
  });
  expect(opener.querySelector(".lucide-message-square")).not.toBeNull();
  expect(opener.querySelector(".lucide-message-square-plus")).toBeNull();
});

it("keeps ordinary record focus outside the discussion", () => {
  render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  const card = screen.getByRole("group");
  card.focus();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(card).toHaveFocus();
});

it("exposes reviewer feedback when navigating to the record anchor", async () => {
  render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  focusReviewRecord("review-record:item:one");
  await waitFor(() =>
    expect(screen.getByText("First item feedback")).toBeVisible(),
  );
});

it("shows only the selected item's comments once and offers no composer", async () => {
  const user = userEvent.setup();
  const second = {
    ...item,
    key: "current:two",
    recordId: "two",
    stableId: "two",
    text: "Second item",
    editTarget: { recordId: "two", source: "current" as const },
    comments: [{ ...comment, id: "two", text: "Second item feedback" }],
  };
  render(
    <>
      <StatusOverviewItemPreview
        item={{ ...item, comments: [comment] }}
        onEditItem={vi.fn()}
      />
      <StatusOverviewItemPreview item={second} onEditItem={vi.fn()} />
    </>,
  );
  await user.click(
    screen.getByRole("button", { name: "Discussion: First item, 1 comments" }),
  );
  const region = screen.getByRole("region", {
    name: "Comments for First item",
  });
  expect(within(region).getByText("First item feedback")).toBeVisible();
  expect(screen.getAllByText("First item feedback")).toHaveLength(1);
  expect(within(region).queryByText("Second item feedback")).toBeNull();
  expect(within(region).queryByRole("textbox")).toBeNull();
});

it("keeps the comments control on a resolved own item", async () => {
  const user = userEvent.setup();
  render(
    <StatusOverviewItemPreview
      item={{
        ...item,
        comments: [comment],
        editTarget: null,
        canRestore: true,
      }}
      onRestorePlan={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Discussion: First item, 1 comments" }),
  );
  expect(
    screen.getByRole("region", { name: "Comments for First item" }),
  ).toBeVisible();
});
