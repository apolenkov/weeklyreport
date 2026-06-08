import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./confirmation-dialog";

describe("ConfirmationDialog", () => {
  it("pressing Escape fires onClose when open=true", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("pressing Escape does NOT fire onClose when open=false", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={false}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking the backdrop (target===currentTarget) fires onClose", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // The backdrop is the outermost element with role="presentation".
    const backdrop = container.querySelector('[role="presentation"]');
    if (!backdrop) throw new Error("backdrop [role=presentation] not found");
    // Directly clicking the backdrop element fires target===currentTarget path.
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking the inner alertdialog does NOT fire onClose (target !== currentTarget guard)", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // Clicking the inner dialog bubbles to the backdrop but target !== currentTarget.
    fireEvent.click(screen.getByRole("alertdialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking Cancel button fires onClose and not onConfirm", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("on open, document.activeElement is the first button inside the dialog", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // The focus-trap effect (useEffect) focuses the first button (Cancel) synchronously
    // in jsdom because cleanup and effects run before test assertions.
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it("inner container has role='alertdialog', aria-modal='true', and aria-label equal to title", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Publish Report"
        description="This will lock all edits."
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Publish Report");
  });

  it("Escape listener is removed when open transitions from true to false", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // Close the dialog by re-rendering with open=false.
    rerender(
      <ConfirmationDialog
        open={false}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // Escape fired after close must not call onClose (listener cleaned up).
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
