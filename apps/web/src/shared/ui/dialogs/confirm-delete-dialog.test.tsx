import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const defaultProps = {
  open: true,
  title: "Delete item?",
  preview: "Quarterly planning item",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderDialog(
  props?: Partial<React.ComponentProps<typeof ConfirmDeleteDialog>>,
) {
  return render(<ConfirmDeleteDialog {...defaultProps} {...props} />);
}

describe("ConfirmDeleteDialog — a11y regression", () => {
  it("calls onCancel when Escape is pressed (document-level keydown handler)", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop (role=presentation) is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) return;
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onCancel when clicking inside the dialog container (stopPropagation)", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("alertdialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("backdrop div has role='presentation'", () => {
    renderDialog();

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("role", "presentation");
  });

  it("inner dialog div has correct ARIA attributes", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-delete-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "confirm-delete-preview",
    );
  });

  it("both dialog actions floor at the touch target below md", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    renderDialog();

    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /delete/i });
    for (const button of [cancel, confirm]) {
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[36px]");
    }
  });

  it("the first focusable control (Cancel) receives focus on open", async () => {
    renderDialog({ confirmLabel: "Delete" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });
  });

  it("traps Tab: Shift+Tab from the first control wraps to the last", async () => {
    renderDialog({ confirmLabel: "Delete" });

    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /delete/i });
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(confirm).toHaveFocus();
  });

  it("returns focus to the trigger when the dialog closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="trigger"
            onClick={() => setOpen(true)}
          >
            Open
          </button>
          <ConfirmDeleteDialog
            {...defaultProps}
            open={open}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);

    // The primitive pulled focus into the dialog (onto Cancel).
    await waitFor(() => {
      expect(trigger).not.toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveFocus();
  });

  it("does NOT call onConfirm when Enter is pressed while focus is elsewhere (reflexive-Enter guard)", async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    // Focus lands on Cancel by default (least-destructive-first); Enter here
    // must not confirm the delete.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm exactly once when Enter is pressed while the Confirm button holds focus", async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, confirmLabel: "Delete" });

    const confirm = screen.getByRole("button", { name: /delete/i });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });
    // Mirrors the tab-trap test above: Shift+Tab from Cancel wraps to Confirm.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks confirm, Enter, and dismissal while pending", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({
      isPending: true,
      onConfirm,
      onCancel,
      confirmLabel: "Delete",
    });

    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = document.querySelector('[role="presentation"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
