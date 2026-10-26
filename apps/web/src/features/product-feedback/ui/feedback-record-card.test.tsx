// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

  it("exposes workflow disclosure state via aria-expanded", () => {
    renderCard(agentationItem);

    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-expanded", "false");
    expect(edit).toHaveAttribute(
      "aria-controls",
      `feedback-edit-${agentationItem.id}`,
    );
    fireEvent.click(edit);
    expect(edit).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("textbox", { name: "Original feedback" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(edit).toHaveAttribute("aria-expanded", "false");
  });

  it("renders every admitted diagnostic, duplicates and '#1' suffixes included", () => {
    // The capture schema already bounds admitted diagnostics (50 console /
    // 20 network); the renderer must preserve all of them with keys that
    // keep identical duplicates distinct without colliding with a message
    // that literally ends in "#1".
    const duplicate = {
      level: "error",
      message: "same failure",
      timestamp: "2026-09-04T10:05:00.000Z",
    };
    const suffixed = { ...duplicate, message: "same failure#1" };
    const failedFetch = {
      method: "GET",
      status: 500,
      url: "https://example.com/api",
      timestamp: "2026-09-04T10:05:00.000Z",
    };
    renderCard({
      ...agentationItem,
      screenshotUrl: "https://example.com/shot.png",
      diagnostics: {
        console: [
          ...Array.from({ length: 55 }, () => ({ ...duplicate })),
          ...Array.from({ length: 2 }, () => ({ ...suffixed })),
        ],
        network: Array.from({ length: 25 }, () => ({ ...failedFetch })),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    // Nothing is truncated: all 57 console rows and all 25 network rows show.
    expect(screen.getAllByText(/same failure/)).toHaveLength(57);
    expect(screen.getAllByText(/example\.com\/api/)).toHaveLength(25);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it("preserves large valid viewport dimensions as stored", () => {
    renderCard({
      ...agentationItem,
      viewport: "5120x2880",
      screenshotUrl: "https://example.com/shot.png",
    });

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const shot = screen.getByAltText(
      "Page screenshot captured with this annotation",
    );
    expect(shot).toHaveAttribute("width", "5120");
    expect(shot).toHaveAttribute("height", "2880");
  });

  it("remounts the edit form with the newly selected record's message", () => {
    const { rerender } = renderCard(agentationItem);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("textbox", { name: "Original feedback" }),
    ).toHaveValue(agentationItem.message);

    const next = {
      ...agentationItem,
      id: "agentation_annotation-2",
      message: "A different record's message",
    };
    rerender(
      <FeedbackRecordCard
        item={next}
        onChangeStatus={vi.fn()}
        onEdit={vi.fn(() => Promise.resolve())}
        onReply={vi.fn(() => Promise.resolve())}
        onDismiss={vi.fn(() => Promise.resolve())}
        onDelete={vi.fn(() => Promise.resolve())}
      />,
    );

    // Without a per-record key the form would keep showing the first
    // record's seeded text and could save over the wrong record.
    expect(
      screen.getByRole("textbox", { name: "Original feedback" }),
    ).toHaveValue("A different record's message");
  });

  it("fires the edit handler once for two same-tick submits", async () => {
    let resolveEdit!: () => void;
    const onEdit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveEdit = resolve;
        }),
    );
    renderCard(agentationItem, { onEdit });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Original feedback" }),
      { target: { value: "Clearer wording" } },
    );

    const save = screen.getByRole("button", { name: "Save changes" });
    // Both clicks share one render closure, so a state-only pending flag
    // cannot stop the second call; the ref guard must.
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(agentationItem.id, "Clearer wording");
    resolveEdit();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus(),
    );
  });

  it("fires the delete handler once for two same-tick confirms", async () => {
    let resolveDelete!: () => void;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    renderCard(agentationItem, { onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const confirm = screen.getByRole("button", {
      name: "Delete permanently",
    });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(agentationItem.id);
    resolveDelete();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus(),
    );
  });

  it("falls back to default dimensions for a degenerate viewport", () => {
    renderCard({
      ...agentationItem,
      viewport: "0x0",
      screenshotUrl: "https://example.com/shot.png",
    });

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const shot = screen.getByAltText(
      "Page screenshot captured with this annotation",
    );
    expect(shot).toHaveAttribute("width", "1280");
    expect(shot).toHaveAttribute("height", "720");
  });
});

// TASK-503.89 characterization (wave12 C4718 / C4738): bounded observations at
// admitted sizes, not native proof.
describe("FeedbackRecordCard wave12 residual clauses", () => {
  const entry = {
    level: "error",
    message: "same failure",
    timestamp: "2026-09-04T10:05:00.000Z",
  };
  const fetchFail = {
    method: "GET",
    status: 500,
    url: "https://example.com/api",
    timestamp: "2026-09-04T10:05:00.000Z",
  };
  const withDiagnostics = (consoleCount: number): FeedbackCardItem => ({
    ...agentationItem,
    screenshotUrl: "https://example.com/shot.png",
    diagnostics: {
      console: Array.from({ length: consoleCount }, () => ({ ...entry })),
      network: Array.from({ length: 20 }, () => ({ ...fetchFail })),
    },
  });
  const card = (item: FeedbackCardItem) => (
    <FeedbackRecordCard
      item={item}
      onChangeStatus={vi.fn()}
      onEdit={vi.fn(() => Promise.resolve())}
      onReply={vi.fn(() => Promise.resolve())}
      onDismiss={vi.fn(() => Promise.resolve())}
      onDelete={vi.fn(() => Promise.resolve())}
    />
  );
  // A node is "unchanged" only when it is the same reference. The installed
  // `toEqual` matcher compares DOM nodes with `isEqualNode`, so it would accept
  // a rerender that replaced every row with a fresh but structurally equal
  // node; `toBe` is the identity check the row-preservation claim needs.
  const expectSameNodeReferences = (
    actual: readonly Node[],
    expected: readonly Node[],
  ): void => {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((node, index) => {
      expect(actual[index], `row ${index}`).toBe(node);
    });
  };

  it("C4718: keeps every admitted duplicate row and the unchanged DOM nodes across a rerender", () => {
    const { rerender } = renderCard(withDiagnostics(49));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const before = screen.getAllByText(/same failure/);
    expect(before).toHaveLength(49);
    rerender(card(withDiagnostics(50)));
    const after = screen.getAllByText(/same failure/);
    expect(after).toHaveLength(50);
    expect(screen.getAllByText(/example\.com\/api/)).toHaveLength(20);
    expectSameNodeReferences(after.slice(0, 49), before);
  });

  it("C4718: rejects a fresh but structurally equal replaced row", () => {
    // Negative control for the identity predicate above, using the regression
    // it must catch: a fresh render of the same payload yields rows that are
    // structurally equal (`isEqualNode`), yet no row is an original node.
    const first = renderCard(withDiagnostics(49));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const original = screen.getAllByText(/same failure/);
    expect(original).toHaveLength(49);
    first.unmount();
    renderCard(withDiagnostics(49));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const replacement = screen.getAllByText(/same failure/);
    expect(replacement).toHaveLength(49);
    expect(replacement[0]?.isEqualNode(original[0] ?? null)).toBe(true);
    expect(() => expectSameNodeReferences(replacement, original)).toThrow();
  });

  it("C4738: every workflow trigger reports its open state", () => {
    renderCard(agentationItem);
    for (const name of ["Edit", "Reply", "Dismiss", "Delete"]) {
      const trigger = screen.getByRole("button", { name });
      expect(trigger, name).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(trigger, name).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(trigger, name).toHaveAttribute("aria-expanded", "false");
    }
  });
});
