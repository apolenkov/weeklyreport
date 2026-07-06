/**
 * VA-0a regression: a11y assertions for ConfirmDeleteDialog.
 *
 * Covers the high-priority unit-rtl rows from the verify-a11y catalog
 * (openspec/changes/verify-a11y-recommended-flip/design.md):
 *  - Escape key calls onCancel (document-level keydown handler)
 *  - Cancel button click calls onCancel
 *  - Backdrop (role=presentation) click calls onCancel
 *  - Inner dialog click does NOT call onCancel (stopPropagation guard)
 *  - Backdrop div has role="presentation"
 *  - Inner dialog has correct ARIA attributes
 *  - Destructive confirm button receives focus on open (rAF-deferred)
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("ConfirmDeleteDialog — a11y regression (VA-0a)", () => {
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

    fireEvent.click(screen.getByRole("dialog"));

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

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-delete-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "confirm-delete-preview",
    );
  });

  it("both dialog actions floor at the touch target below md (responsive-compact-layout)", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    renderDialog();

    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /delete/i });
    for (const button of [cancel, confirm]) {
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[36px]");
    }
  });

  it("destructive confirm button receives focus on open (rAF-deferred autoFocus)", async () => {
    renderDialog({ confirmLabel: "Delete" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).toHaveFocus();
    });
  });
});
