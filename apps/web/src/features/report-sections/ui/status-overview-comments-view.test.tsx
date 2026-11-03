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

it("submits the controlled reply by keyboard and keeps multiline Enter", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onSend = vi.fn();
  render(
    <StatusOverviewCommentsView
      id="c"
      itemLabel="Item"
      comments={[]}
      onClose={vi.fn()}
      composer={{ value: "Draft", onChange, onSend, state: "idle" }}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Reply to Item" });
  await user.click(input);
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledWith("Draft\n");
  expect(onSend).not.toHaveBeenCalled();
  await user.tab();
  expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledOnce();
});

it("prevents duplicate sends while pending and preserves controlled input", () => {
  const onSend = vi.fn();
  render(
    <StatusOverviewCommentsView
      id="c"
      itemLabel="Item"
      comments={[comment]}
      onClose={vi.fn()}
      composer={{
        value: "Keep this",
        onChange: vi.fn(),
        onSend,
        state: "pending",
      }}
    />,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Keep this");
  expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  expect(onSend).not.toHaveBeenCalled();
});

it.each([
  ["error", /could not send/i],
  ["uncertain", /check the discussion before/i],
  ["refresh-failed", /sent.*refresh failed/i],
] as const)("shows actionable %s state", (state, message) => {
  const onRefresh = vi.fn();
  render(
    <StatusOverviewCommentsView
      id="c"
      itemLabel="Item"
      comments={[]}
      onClose={vi.fn()}
      composer={{
        value: "Keep this",
        onChange: vi.fn(),
        onSend: vi.fn(),
        state,
        onRefresh,
      }}
    />,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Keep this");
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  if (state !== "error") {
    screen.getByRole("button", { name: /refresh discussion/i }).click();
    expect(onRefresh).toHaveBeenCalledOnce();
  }
});

it("shows authors and timestamps in the supplied chronological order", () => {
  const reply = {
    ...comment,
    id: "reply",
    reviewerName: "Lead",
    text: "Reply",
    createdAt: new Date("2026-09-11T10:00:00Z"),
  };
  render(
    <StatusOverviewCommentsView
      id="c"
      itemLabel="Item"
      comments={[comment, reply]}
      onClose={vi.fn()}
    />,
  );
  const messages = screen.getAllByRole("listitem");
  expect(within(messages[0]).getByText("Head")).toBeVisible();
  expect(within(messages[1]).getByText("Lead")).toBeVisible();
  expect(messages[0].querySelector("time")).toHaveAttribute(
    "datetime",
    comment.createdAt.toISOString(),
  );
  expect(messages[1].querySelector("time")).toHaveAttribute(
    "datetime",
    reply.createdAt.toISOString(),
  );
});
