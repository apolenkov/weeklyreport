// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type FeedbackCardItem,
  FeedbackRecordCard,
} from "./feedback-record-card";

const agentationItem: FeedbackCardItem = {
  id: "agentation_annotation-1",
  type: "change",
  status: "open",
  url: "/lead/report/report-1",
  message: "Move the action closer to the field",
  authorName: "Lead User",
  authorUserId: "lead-user",
  createdAt: new Date("2026-09-04T10:00:00.000Z"),
  updatedAt: new Date("2026-09-04T10:05:00.000Z"),
  viewport: "1440x900",
  annotations: [{ id: "annotation-1" }],
  screenshotUrl: null,
  screenshotRegion: null,
  diagnostics: null,
  agentationSessionId: "session-1",
  agentationAnnotationId: "annotation-1",
  source: "agentation",
  capabilities: {
    editOriginal: true,
    triage: true,
    reply: true,
    dismiss: true,
    delete: true,
  },
  thread: [
    {
      id: "message-1",
      role: "human",
      content: "I can reproduce this.",
      timestamp: "2026-09-04T10:05:00.000Z",
      authorUserId: "reviewer-user",
    },
  ],
  agentationContext: {
    element: "button",
    elementPath: "#save-report",
    selectedText: "Save report",
    nearbyText: null,
    sourceFile: "lead-form.tsx",
    reactComponents: "SaveButton",
    accessibility: "button",
  },
};

const renderCard = (
  item: FeedbackCardItem,
  overrides: Partial<ComponentProps<typeof FeedbackRecordCard>> = {},
) =>
  render(
    <FeedbackRecordCard
      item={item}
      onChangeStatus={vi.fn()}
      onEdit={vi.fn(() => Promise.resolve())}
      onReply={vi.fn(() => Promise.resolve())}
      onDismiss={vi.fn(() => Promise.resolve())}
      onDelete={vi.fn(() => Promise.resolve())}
      {...overrides}
    />,
  );

describe("FeedbackRecordCard workbench", () => {
  it("uses only server capabilities to expose actions", () => {
    const denied = {
      ...agentationItem,
      capabilities: {
        editOriginal: false,
        triage: false,
        reply: false,
        dismiss: false,
        delete: false,
      },
    };
    const { rerender } = renderCard(denied);

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByLabelText(/Status for feedback/)).toBeNull();

    rerender(
      <FeedbackRecordCard
        item={agentationItem}
        onChangeStatus={vi.fn()}
        onEdit={vi.fn(() => Promise.resolve())}
        onReply={vi.fn(() => Promise.resolve())}
        onDismiss={vi.fn(() => Promise.resolve())}
        onDelete={vi.fn(() => Promise.resolve())}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reply" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(screen.getByLabelText(/Status for feedback/)).toBeVisible();
  });

  it("separates Agentation Dismissed from legacy Won't fix", () => {
    const dismissed = { ...agentationItem, status: "wont_fix" as const };
    const { rerender } = renderCard(dismissed);

    expect(screen.getByText("Dismissed")).toBeVisible();
    expect(screen.queryByLabelText(/Status for feedback/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();

    rerender(
      <FeedbackRecordCard
        item={{
          ...dismissed,
          id: "legacy-1",
          source: "legacy",
          capabilities: { ...dismissed.capabilities, triage: false },
        }}
        onChangeStatus={vi.fn()}
      />,
    );
    expect(screen.getByText("Won't fix")).toBeVisible();
  });

  it("shows captured context, thread actor, and timestamp in Details", () => {
    renderCard(agentationItem);

    const details = screen.getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute(
      "aria-controls",
      "feedback-details-agentation_annotation-1",
    );
    fireEvent.click(details);

    expect(
      screen.getByRole("region", { name: "Agentation record" }),
    ).toHaveTextContent("/lead/report/report-1");
    expect(screen.getByText("session-1")).toBeVisible();
    expect(screen.getByText("annotation-1")).toBeVisible();
    expect(screen.getByText("Captured target context")).toBeVisible();
    expect(screen.getByText("SaveButton")).toBeVisible();
    expect(screen.getByText("User · reviewer-user")).toBeVisible();
    expect(screen.getByText("I can reproduce this.")).toBeVisible();
    expect(screen.getAllByText(/Sep 4, 2026/)).toHaveLength(2);
  });

  it("derives the source badge from the server source", () => {
    const { rerender } = renderCard(agentationItem);
    expect(screen.getByText("Agentation")).toBeVisible();

    rerender(
      <FeedbackRecordCard
        item={{
          ...agentationItem,
          id: "legacy-1",
          source: "legacy",
          annotations: [{ id: "legacy-annotation-1" }],
        }}
        onChangeStatus={vi.fn()}
      />,
    );
    expect(screen.getByText("Legacy feedback")).toBeVisible();
    expect(screen.queryByText("Agentation")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(
      screen.getByRole("region", { name: "Feedback record" }),
    ).toHaveTextContent("/lead/report/report-1");
  });

  it("keeps a failed edit open and restores focus after a successful retry", async () => {
    const onEdit = vi
      .fn<(id: string, value: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce();
    renderCard(agentationItem, { onEdit });

    const trigger = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: "Original feedback" });
    fireEvent.change(input, { target: { value: "  Clearer wording  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update feedback",
    );
    expect(input).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onEdit).toHaveBeenLastCalledWith(
        agentationItem.id,
        "Clearer wording",
      ),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(
      screen.queryByRole("textbox", { name: "Original feedback" }),
    ).toBeNull();
  });

  it("submits a trimmed reply and restores focus to Reply", async () => {
    const onReply = vi.fn(() => Promise.resolve());
    renderCard(agentationItem, { onReply });

    const trigger = screen.getByRole("button", { name: "Reply" });
    fireEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: "Reply" });
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "  Please retest  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(onReply).toHaveBeenCalledWith(agentationItem.id, "Please retest"),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("requires a dismiss reason and keeps failures recoverable", async () => {
    const onDismiss = vi.fn(() => Promise.reject(new Error("offline")));
    renderCard(agentationItem, { onDismiss });

    const trigger = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(trigger);
    const confirm = screen.getByRole("button", { name: "Confirm dismiss" });
    expect(confirm).toBeDisabled();
    const reason = screen.getByRole("textbox", { name: "Reason (required)" });
    expect(reason).toHaveFocus();
    fireEvent.change(reason, { target: { value: "  Not actionable  " } });
    fireEvent.click(confirm);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not dismiss feedback",
    );
    expect(onDismiss).toHaveBeenCalledWith(agentationItem.id, "Not actionable");
    expect(reason).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("confirms deletion, recovers from failure, and restores focus", async () => {
    const onDelete = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce();
    renderCard(agentationItem, { onDelete });
    const trigger = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete this feedback permanently?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Delete this feedback permanently?");
    expect(dialog).toHaveTextContent("This cannot be undone.");
    expect(
      screen.queryByRole("region", { name: "Confirm deletion" }),
    ).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete feedback",
    );
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(onDelete).toHaveBeenLastCalledWith(agentationItem.id),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
