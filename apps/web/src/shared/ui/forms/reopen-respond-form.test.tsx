import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReopenRespondForm } from "./reopen-respond-form";

function renderForm(pendingDecision?: "approved" | "rejected") {
  const actions = {
    onNoteChange: vi.fn(),
    onCancel: vi.fn(),
    onReject: vi.fn(),
    onApprove: vi.fn(),
  };

  render(
    <ReopenRespondForm
      requestId="request-1"
      note=""
      isPending={pendingDecision !== undefined}
      pendingDecision={pendingDecision}
      {...actions}
    />,
  );

  return actions;
}

describe("ReopenRespondForm", () => {
  it("routes note and decision actions through the shared form", () => {
    const actions = renderForm();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ready" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(actions.onNoteChange).toHaveBeenCalledWith("Ready");
    expect(actions.onReject).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "500");
  });

  it("marks decision buttons as mutating while keeping cancel client-only", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Reject" })).toHaveAttribute(
      "data-interaction-effect",
      "mutation-required",
    );
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute(
      "data-interaction-effect",
      "mutation-required",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveAttribute(
      "data-interaction-effect",
    );
  });

  it.each([
    ["approved", "Reject"],
    ["rejected", "Approve"],
  ] as const)(
    "marks only the pending %s action as saving",
    (decision, other) => {
      renderForm(decision);

      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
      expect(screen.getByRole("button", { name: other })).toBeDisabled();
    },
  );
});
