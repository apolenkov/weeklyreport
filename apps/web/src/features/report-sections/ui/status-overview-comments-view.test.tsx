// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusOverviewCommentsView } from "./status-overview-comments-view";

const comment = {
  id: "30000000-0000-4000-8000-000000000001",
  reviewerId: "10000000-0000-4000-8000-000000000002",
  reviewerName: "Head",
  text: "Please clarify the rollout",
  createdAt: new Date("2026-09-10T09:00:00.000Z"),
};

describe("StatusOverviewCommentsView", () => {
  it("shows supplied comments in a named region for the item", () => {
    render(
      <StatusOverviewCommentsView
        id="comments-1"
        itemLabel="Ship feature"
        comments={[comment]}
        onClose={vi.fn()}
      />,
    );
    const region = screen.getByRole("region", {
      name: "Comments for Ship feature",
    });
    expect(region).toHaveAttribute("id", "comments-1");
    expect(
      within(region).getByText("Please clarify the rollout"),
    ).toBeVisible();
    expect(within(region).getByText("Head")).toBeVisible();
    expect(
      within(region).queryByText("No comments yet."),
    ).not.toBeInTheDocument();
  });

  it("shows an explicit empty state without a composer", () => {
    render(
      <StatusOverviewCommentsView
        id="comments-1"
        itemLabel="Ship feature"
        comments={[]}
        onClose={vi.fn()}
      />,
    );
    const region = screen.getByRole("region", {
      name: "Comments for Ship feature",
    });
    expect(within(region).getByText("No comments yet.")).toBeVisible();
    expect(within(region).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(region).queryByRole("button", {
        name: /reply|send|submit|add comment/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("closes via keyboard and offers no composer when comments exist", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <StatusOverviewCommentsView
        id="comments-1"
        itemLabel="Ship feature"
        comments={[comment]}
        onClose={onClose}
      />,
    );
    const region = screen.getByRole("region", {
      name: "Comments for Ship feature",
    });
    expect(within(region).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(region).queryByRole("button", {
        name: /reply|send|submit|add comment/i,
      }),
    ).not.toBeInTheDocument();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /close comments/i }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
