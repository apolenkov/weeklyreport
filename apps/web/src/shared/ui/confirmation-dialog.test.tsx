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
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    // The backdrop is the outermost element with role="presentation".
    const backdrop = document.querySelector('[role="presentation"]');
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

  it("connects the alertdialog to its visible description", () => {
    render(
      <ConfirmationDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Publish Report"
        description="This will lock all edits."
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    const description = screen.getByText("This will lock all edits.");

    expect(description).toHaveAttribute("id");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      description.getAttribute("id"),
    );
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

  it("Tab from the last focusable wraps to the first (focus trap)", () => {
    render(
      <ConfirmationDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item?"
        description="Are you sure?"
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    confirmBtn.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancelBtn).toHaveFocus();
  });

  it("restores focus to the trigger when the dialog closes", () => {
    function Harness({ open }: { readonly open: boolean }) {
      return (
        <>
          <button type="button" data-testid="trigger">
            Open
          </button>
          <ConfirmationDialog
            open={open}
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            title="Delete Item?"
            description="Are you sure?"
          />
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<Harness open={true} />);
    expect(trigger).not.toHaveFocus();

    rerender(<Harness open={false} />);
    expect(trigger).toHaveFocus();
  });

  it("renders rich context and disables both actions while pending", () => {
    render(
      <ConfirmationDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete period?"
        description={
          <>
            Delete <strong>Week 16</strong> permanently.
          </>
        }
        confirmLabel="Deleting…"
        variant="destructive"
        isPending={true}
      />,
    );

    expect(screen.getByText("Week 16").tagName).toBe("STRONG");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("blocks Escape and backdrop dismissal while pending", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete period?"
        description="Are you sure?"
        isPending={true}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = document.querySelector('[role="presentation"]');
    if (backdrop) fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
