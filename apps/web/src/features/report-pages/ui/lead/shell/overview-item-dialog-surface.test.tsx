import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useDiscardGuard } from "../../../../../shared/ui/dialogs/use-discard-guard";
import { OverviewItemDialogSurface } from "./overview-item-dialog-surface";

function DirtyEditor({ onClose }: { readonly onClose: () => void }) {
  const { requestClose, discardDialog } = useDiscardGuard(true, onClose);
  return (
    <OverviewItemDialogSurface title="Add item" onCancel={onClose}>
      <form aria-label="Current week update for Payments">
        <input aria-label="Description" defaultValue="Retained input" />
        <button type="button" onClick={requestClose}>
          Cancel
        </button>
      </form>
      {discardDialog}
    </OverviewItemDialogSurface>
  );
}

describe("Overview item dialog dismissal", () => {
  it.each(["Escape", "Close", "outside", "Cancel"])(
    "%s takes the canonical Cancel discard path without losing input",
    async (dismissal) => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DirtyEditor onClose={onClose} />);
      const dialog = screen.getByRole("dialog", { name: "Add item" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      if (dismissal === "Escape") await user.keyboard("{Escape}");
      else if (dismissal === "outside") {
        const overlay = document.querySelector("[data-slot=dialog-overlay]");
        if (!overlay) throw new Error("Expected the modal overlay");
        await user.click(overlay);
      } else
        await user.click(
          within(dialog).getByRole("button", { name: dismissal }),
        );
      const confirmation = await screen.findByRole("alertdialog", {
        name: "Discard changes?",
      });
      expect(onClose).not.toHaveBeenCalled();
      await user.click(
        within(confirmation).getByRole("button", { name: "Keep editing" }),
      );
      expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
        "Retained input",
      );
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await user.click(screen.getByRole("button", { name: "Discard" }));
      expect(onClose).toHaveBeenCalledOnce();
    },
  );
});
