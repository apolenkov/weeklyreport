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
  render(<StatusOverviewItemPreview item={item} onEditItem={vi.fn()} />);
  const opener = screen.getByRole("button", { name: "Comments on First item" });
  expect(opener).toHaveAttribute("aria-expanded", "false");
  opener.focus();
  await user.keyboard("{Enter}");
  const region = screen.getByRole("region", {
    name: "Comments for First item",
  });
  expect(opener).toHaveAttribute("aria-expanded", "true");
  expect(opener).toHaveAttribute("aria-controls", region.id);
  expect(within(region).getByText("No comments yet.")).toBeVisible();
  await user.click(
    within(region).getByRole("button", { name: "Close comments" }),
  );
  expect(
    screen.queryByRole("region", { name: "Comments for First item" }),
  ).toBeNull();
  expect(opener).toHaveFocus();
  expect(opener).toHaveAttribute("aria-expanded", "false");
});

it("lets keyboard users reach close after opening and restores focus", async () => {
  const user = userEvent.setup();
  render(<StatusOverviewItemPreview item={item} onEditItem={vi.fn()} />);
  const opener = screen.getByRole("button", { name: "Comments on First item" });
  opener.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Close comments" })).toHaveFocus();
  await user.tab();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Close comments" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(opener).toHaveFocus();
});

it("does not carry an open region to a different item in a reused card", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <StatusOverviewItemPreview item={item} onEditItem={vi.fn()} />,
  );
  await user.click(
    screen.getByRole("button", { name: "Comments on First item" }),
  );
  const second = {
    ...item,
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
    screen.getByRole("button", { name: "Comments on Second item" }),
  ).toHaveAttribute("aria-expanded", "false");
  rerender(<StatusOverviewItemPreview item={item} onEditItem={vi.fn()} />);
  expect(
    screen.queryByRole("region", { name: "Comments for First item" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Comments on First item" }),
  ).toHaveAttribute("aria-expanded", "false");
});

it("uses a plain read-comment icon, not an add-comment icon", () => {
  render(<StatusOverviewItemPreview item={item} onEditItem={vi.fn()} />);
  const opener = screen.getByRole("button", { name: "Comments on First item" });
  expect(opener.querySelector(".lucide-message-square")).not.toBeNull();
  expect(opener.querySelector(".lucide-message-square-plus")).toBeNull();
});

it("does not steal programmatic card focus when revealing feedback", async () => {
  render(
    <StatusOverviewItemPreview
      item={{ ...item, comments: [comment] }}
      onEditItem={vi.fn()}
    />,
  );
  const card = screen.getByRole("group");
  card.focus();
  await waitFor(() =>
    expect(screen.getByText("First item feedback")).toBeVisible(),
  );
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
    screen.getByRole("button", { name: "Comments on First item" }),
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
      item={{ ...item, editTarget: null, canRestore: true }}
      onRestorePlan={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Comments on First item" }),
  );
  expect(
    screen.getByRole("region", { name: "Comments for First item" }),
  ).toBeVisible();
});
