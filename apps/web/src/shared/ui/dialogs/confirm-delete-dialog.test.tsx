import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, useState } from "react";
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
    // Default props show the irreversibility note, which is part of the description (C5243).
    expect(dialog).toHaveAccessibleDescription(
      "Quarterly planning item This action cannot be undone.",
    );
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

// TASK-503.43 contracts for the frozen shared-confirmation clauses. RED = fails on
// the current source; "control" = holds today and must keep holding. jsdom proves
// DOM/focus contracts only; native AT, Tab order and request counts stay with the
// separate native windows named in the TASK-503.43 contract.
describe("ConfirmDeleteDialog — shared confirmation contracts (TASK-503.43)", () => {
  const deleteButton = () => screen.getByRole("button", { name: /delete/i });

  describe("C5240 one-shot confirm while the host has not reported pending yet", () => {
    it("invokes onConfirm once for two rapid clicks", () => {
      const onConfirm = vi.fn();
      renderDialog({ onConfirm, isPending: false, confirmLabel: "Delete" });

      fireEvent.click(deleteButton());
      fireEvent.click(deleteButton());

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("invokes onConfirm once for two Enter presses on the focused confirm button", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      renderDialog({ onConfirm, isPending: false, confirmLabel: "Delete" });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
      });
      await user.tab({ shift: true });
      expect(deleteButton()).toHaveFocus();

      await user.keyboard("{Enter}{Enter}");

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("control: a single click confirms once", () => {
      const onConfirm = vi.fn();
      renderDialog({ onConfirm, isPending: false, confirmLabel: "Delete" });

      fireEvent.click(deleteButton());

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("control: confirm works again after the host's pending phase ended with the dialog still open", () => {
      const onConfirm = vi.fn();
      const props = { ...defaultProps, onConfirm, confirmLabel: "Delete" };
      const { rerender } = render(
        <ConfirmDeleteDialog {...props} isPending={false} />,
      );
      fireEvent.click(deleteButton());

      rerender(<ConfirmDeleteDialog {...props} isPending={true} />);
      rerender(<ConfirmDeleteDialog {...props} isPending={false} />);
      fireEvent.click(deleteButton());

      expect(onConfirm).toHaveBeenCalledTimes(2);
    });

    it("control: a host that omits isPending can confirm again while the dialog stays open", () => {
      const onConfirm = vi.fn();
      renderDialog({ onConfirm, confirmLabel: "Delete" });

      fireEvent.click(deleteButton());
      fireEvent.click(deleteButton());

      expect(onConfirm).toHaveBeenCalledTimes(2);
    });

    it("control: confirm works again after the dialog was closed and reopened", async () => {
      const onConfirm = vi.fn();
      const props = { ...defaultProps, onConfirm, confirmLabel: "Delete" };
      const { rerender } = render(
        <ConfirmDeleteDialog {...props} isPending={false} />,
      );
      fireEvent.click(deleteButton());

      rerender(
        <ConfirmDeleteDialog {...props} open={false} isPending={false} />,
      );
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
      rerender(<ConfirmDeleteDialog {...props} isPending={false} />);
      fireEvent.click(deleteButton());

      expect(onConfirm).toHaveBeenCalledTimes(2);
    });
  });
  describe("C5241 focus while pending", () => {
    it("control: opening already pending keeps focus inside the dialog and off the destructive action", () => {
      renderDialog({ isPending: true, confirmLabel: "Delete" });

      const dialog = screen.getByRole("alertdialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(deleteButton()).not.toHaveFocus();
    });

    it("keeps focus inside the dialog when the focused Cancel turns disabled by pending", async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps, confirmLabel: "Delete" };
      const { rerender } = render(<ConfirmDeleteDialog {...props} />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
      });

      rerender(<ConfirmDeleteDialog {...props} isPending />);

      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveFocus();
      await user.tab();
      expect(dialog).toHaveFocus();
      await user.tab({ shift: true });
      expect(dialog).toHaveFocus();
    });
  });

  describe("C5243 risk context in the accessible description", () => {
    const risk = {
      subtitle: "Owner: Ana",
      consequence: "All slides are removed.",
    };

    it("reads preview, subtitle, consequence and the irreversibility note", () => {
      renderDialog({ ...risk, reversible: false });

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "Quarterly planning item Owner: Ana All slides are removed. This action cannot be undone.",
      );
    });

    it("reads the reversibility note when the action can be reversed", () => {
      renderDialog({ ...risk, reversible: true });

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "Quarterly planning item Owner: Ana All slides are removed. This can be reversed later.",
      );
    });

    it("leaves out the reversibility note when the client cannot know it", () => {
      renderDialog({ ...risk, showReversibility: false });

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "Quarterly planning item Owner: Ana All slides are removed.",
      );
    });

    it("includes the shown irreversibility note even without subtitle or consequence", () => {
      renderDialog({ reversible: false });

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "Quarterly planning item This action cannot be undone.",
      );
    });

    it("control: with only the preview the description is the preview", () => {
      renderDialog({ showReversibility: false });

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "Quarterly planning item",
      );
    });

    it("control: every described-by reference resolves and stays unique across two dialogs with full context", () => {
      render(
        <>
          <ConfirmDeleteDialog {...defaultProps} {...risk} />
          <ConfirmDeleteDialog
            {...defaultProps}
            {...risk}
            title="Delete second item?"
            preview="Second planning item"
          />
        </>,
      );

      const ids = [
        ...document.querySelectorAll<HTMLElement>('[role="alertdialog"]'),
      ].flatMap((dialog) =>
        (dialog.getAttribute("aria-describedby") ?? "").trim().split(/\s+/u),
      );
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
    });
  });

  describe("C5246 focus restore target", () => {
    function RestoreHarness({
      triggerRef,
    }: {
      readonly triggerRef: RefObject<HTMLElement | null>;
    }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="opener"
            onClick={() => setOpen(true)}
          >
            Open
          </button>
          <button type="button" data-testid="other">
            Other
          </button>
          <ConfirmDeleteDialog
            {...defaultProps}
            open={open}
            triggerRef={triggerRef}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    const openFromOpenerThenEscape = async () => {
      const opener = screen.getByTestId("opener");
      opener.focus();
      fireEvent.click(opener);
      await waitFor(() => {
        expect(opener).not.toHaveFocus();
      });
      fireEvent.keyDown(document, { key: "Escape" });
      return opener;
    };

    it("control: a connected explicit trigger ref wins over the previously focused element", async () => {
      const triggerRef: { current: HTMLElement | null } = { current: null };
      render(<RestoreHarness triggerRef={triggerRef} />);
      triggerRef.current = screen.getByTestId("other");

      await openFromOpenerThenEscape();

      await waitFor(() => expect(screen.getByTestId("other")).toHaveFocus());
    });

    it("control: a null trigger ref falls back to the previously focused element", async () => {
      const triggerRef: { current: HTMLElement | null } = { current: null };
      render(<RestoreHarness triggerRef={triggerRef} />);

      const opener = await openFromOpenerThenEscape();

      await waitFor(() => expect(opener).toHaveFocus());
    });

    // Synthetic: React clears refs of unmounted elements, so a stale node needs an
    // out-of-React removal. Proves the focus seam only; public removed-opener
    // admission stays deferred (TASK-503.43 contract, C5246).
    it("falls back to the previously focused element when the explicit trigger node is disconnected", async () => {
      const detached = document.createElement("button");
      const triggerRef: { current: HTMLElement | null } = { current: detached };
      render(<RestoreHarness triggerRef={triggerRef} />);

      const opener = await openFromOpenerThenEscape();

      await waitFor(() => expect(opener).toHaveFocus());
    });
  });
});
