import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const dialogOverlay = (): Element => {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]');
  if (!overlay) throw new Error("dialog overlay not found");
  return overlay;
};

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
  it("calls onCancel when Escape is pressed", () => {
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

  it("calls onCancel when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    await user.click(dialogOverlay());

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it("does not call onCancel when clicking inside the dialog", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("alertdialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders one primitive-owned backdrop", () => {
    renderDialog();

    const backdrop = dialogOverlay();
    expect(backdrop).toHaveAttribute("data-state", "open");
  });

  it("inner dialog div has correct ARIA attributes", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    const descriptionId = dialog.getAttribute("aria-describedby");
    expect(labelId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(dialog).toHaveAccessibleName("Delete item?");
    expect(dialog).toHaveAccessibleDescription("Quarterly planning item");
    for (const id of [labelId, descriptionId].flatMap((value) =>
      (value ?? "").trim().split(/\s+/u),
    )) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("keeps title and description IDREFs unique across mounted dialogs", () => {
    render(
      <>
        <ConfirmDeleteDialog {...defaultProps} />
        <ConfirmDeleteDialog
          {...defaultProps}
          title="Delete second item?"
          preview="Second planning item"
        />
      </>,
    );

    const dialogs = [
      ...document.querySelectorAll<HTMLElement>('[role="alertdialog"]'),
    ];
    expect(dialogs).toHaveLength(2);
    const labelIds = dialogs.flatMap((dialog) =>
      (dialog.getAttribute("aria-labelledby") ?? "").trim().split(/\s+/u),
    );
    const descriptionIds = dialogs.flatMap((dialog) =>
      (dialog.getAttribute("aria-describedby") ?? "").trim().split(/\s+/u),
    );
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(new Set(descriptionIds).size).toBe(descriptionIds.length);
    for (const id of [...labelIds, ...descriptionIds]) {
      expect(id).toBeTruthy();
      expect(document.getElementById(id)).not.toBeNull();
    }
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
    const user = userEvent.setup();
    renderDialog({ confirmLabel: "Delete" });

    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /delete/i });
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });

    await user.tab({ shift: true });

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

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not confirm when Enter activates the focused Cancel button", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });

    // Focus lands on Cancel by default (least-destructive-first); Enter here
    // must not confirm the delete.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });

    await user.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm exactly once when Enter is pressed while the Confirm button holds focus", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, confirmLabel: "Delete" });

    const confirm = screen.getByRole("button", { name: /delete/i });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });
    await user.tab({ shift: true });
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });

    await user.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks confirm, Enter, and dismissal while pending", async () => {
    const user = userEvent.setup();
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
    await user.keyboard("{Enter}");
    await user.click(dialogOverlay());
    expect(onCancel).not.toHaveBeenCalled();
  });
});
