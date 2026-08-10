import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./confirmation-dialog";

const dialogOverlay = (): Element => {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]');
  if (!overlay) throw new Error("dialog overlay not found");
  return overlay;
};

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
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
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

  it("clicking the backdrop fires onClose", async () => {
    const user = userEvent.setup();
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

    await user.click(dialogOverlay());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking inside the alertdialog does not fire onClose", () => {
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

  it("ignores Escape after the dialog closes", () => {
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

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Tab from the last focusable wraps to the first", async () => {
    const user = userEvent.setup();
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
    await user.tab();
    expect(cancelBtn).toHaveFocus();
  });

  it("restores focus to the trigger when the dialog closes", async () => {
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
    await vi.waitFor(() => expect(trigger).toHaveFocus());
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

  it("blocks Escape and backdrop dismissal while pending", async () => {
    const user = userEvent.setup();
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
    await user.click(dialogOverlay());

    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
