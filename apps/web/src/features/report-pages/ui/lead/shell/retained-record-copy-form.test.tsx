import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RetainedRecordCopyForm } from "./retained-record-copy-form";

const copy = {
  kind: "risk" as const,
  sourceParent: { kind: "product" as const, id: "lost-product" },
  input: {
    text: "Retained risk",
    impact: null,
    mitigation: null,
    severity: "blocked" as const,
    stageNames: ["Old stage"],
  },
};
const targets = [
  { kind: "activity" as const, id: "current-activity", name: "Support" },
];
const props = {
  copy,
  targets,
  sourceLabel: "May 11–17, 2026",
  sourceReason:
    "This report is published and can no longer be edited, so these drafts are read-only.",
  blockedReason: null,
  onOpen: vi.fn(() => true),
  onDismiss: vi.fn(),
};

describe("retained draft copy destination", () => {
  it("requires an explicit current context and opens only on review", async () => {
    const onOpen = vi.fn(() => true);
    const onDismiss = vi.fn();
    render(
      <RetainedRecordCopyForm
        {...props}
        onOpen={onOpen}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("Retained risk")).toBeInTheDocument();
    expect(screen.getByText(/May 11–17, 2026/)).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Review copied risk" }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Add to" }),
      "activity:current-activity",
    );
    expect(onOpen).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Review copied risk" }),
    );
    expect(onOpen).toHaveBeenCalledWith(copy, {
      kind: "risk",
      unitKind: "activity",
      unitId: "current-activity",
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("retains the source request when the current editor rejects opening", async () => {
    const onDismiss = vi.fn();
    render(
      <RetainedRecordCopyForm
        {...props}
        onOpen={() => false}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Add to" }),
      "activity:current-activity",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Review copied risk" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The current context changed",
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("rejects a destination removed after selection without guessing another", async () => {
    const onOpen = vi.fn(() => true);
    const view = render(<RetainedRecordCopyForm {...props} onOpen={onOpen} />);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Add to" }),
      "activity:current-activity",
    );
    view.rerender(
      <RetainedRecordCopyForm {...props} onOpen={onOpen} targets={[]} />,
    );
    expect(
      screen.getByRole("button", { name: "Review copied risk" }),
    ).toBeDisabled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("allows dismissal while another input blocks copying", async () => {
    const onOpen = vi.fn(() => true);
    const onDismiss = vi.fn();
    render(
      <RetainedRecordCopyForm
        {...props}
        onOpen={onOpen}
        onDismiss={onDismiss}
        blockedReason="Finish the open input first."
      />,
    );
    expect(
      screen.getByText("Finish the open input first."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review copied risk" }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss copy" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
