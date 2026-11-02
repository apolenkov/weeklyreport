// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackCardItem } from "./feedback-record-card";
import { FeedbackEditForm } from "./feedback-record-workflow-forms";

function itemWith(id: string, message: string): FeedbackCardItem {
  return { id, message } as FeedbackCardItem;
}

describe("FeedbackEditForm identity and concurrent updates", () => {
  it("keeps the typed text when the same record's message changes while editing", () => {
    const { rerender } = render(
      <FeedbackEditForm
        item={itemWith("feedback-1", "Original")}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const field = screen.getByLabelText("Original feedback");
    fireEvent.change(field, { target: { value: "My unsaved draft" } });

    // A concurrent update of the same record must not overwrite the draft:
    // an automatic resync would destroy what the author typed.
    rerender(
      <FeedbackEditForm
        item={itemWith("feedback-1", "Changed by someone else")}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Original feedback")).toHaveValue(
      "My unsaved draft",
    );
  });

  it("saves against the mounted record id, never another list row", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
      <FeedbackEditForm
        item={itemWith("feedback-1", "Original")}
        onEdit={onEdit}
        onCancel={onCancel}
      />,
    );
    fireEvent.change(screen.getByLabelText("Original feedback"), {
      target: { value: "  Edited text  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith("feedback-1", "Edited text");
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });
});
