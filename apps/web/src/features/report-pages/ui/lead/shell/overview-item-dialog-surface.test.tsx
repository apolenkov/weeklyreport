import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDiscardGuard } from "../../../../../shared/ui/dialogs/use-discard-guard";
import { ItemInlineEditor } from "../../../../report-sections/ui/item-inline-editor";
import { OverviewItemDialogSurface } from "./overview-item-dialog-surface";

function DirtyEditor({ onClose }: { readonly onClose: () => void }) {
  const { requestClose, discardDialog } = useDiscardGuard(true, onClose);
  const closeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [requestClose]);
  return (
    <OverviewItemDialogSurface
      title="Add item"
      onCancel={onClose}
      requestCloseRef={closeRef}
    >
      <form aria-label="Current week update for Payments">
        <input aria-label="Description" defaultValue="Retained input" />
        <button type="button" onClick={requestClose}>
          Abandon
        </button>
      </form>
      {discardDialog}
    </OverviewItemDialogSurface>
  );
}

describe("Overview item dialog dismissal", () => {
  it("registers the real editor discard guard for surface Escape and clears it on unmount", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const closeRef: { current: (() => void) | null } = { current: null };
    const { unmount } = render(
      <OverviewItemDialogSurface
        title="Add item"
        onCancel={onClose}
        requestCloseRef={closeRef}
      >
        <ItemInlineEditor
          item={null}
          products={[
            {
              id: "product",
              name: "Payments",
              overallStatus: "on-track",
              stages: [
                {
                  stageName: "Development",
                  ownership: "mine",
                  status: "on-track",
                  assignee: "Lead",
                },
              ],
            },
          ]}
          defaultProductId="product"
          week="current"
          stagesForProduct={() => ["Development"]}
          currentUserName="Lead"
          onSave={vi.fn()}
          onCancel={onClose}
          requestCloseRef={closeRef}
        />
      </OverviewItemDialogSurface>,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Retained input",
    );
    expect(closeRef.current).toEqual(expect.any(Function));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    // Escape outside the form exercises the surface-to-editor registration.
    screen.getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Escape}");
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Discard changes?",
    });
    expect(onClose).not.toHaveBeenCalled();
    await user.click(
      within(confirmation).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Retained input",
    );
    unmount();
    expect(closeRef.current).toBeNull();
  });

  it.each(["Escape", "Close", "outside", "Abandon"])(
    "%s takes the canonical Cancel discard path without losing input",
    async (dismissal) => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DirtyEditor onClose={onClose} />);
      const dialog = screen.getByRole("dialog", { name: "Add item" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      if (dismissal === "Escape") await user.keyboard("{Escape}");
      else if (dismissal === "outside") {
        const overlay = document.querySelector("[data-slot=sheet-overlay]");
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

  it("closes recovery without a form", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <OverviewItemDialogSurface
        title="Recovery"
        onCancel={onClose}
        requestCloseRef={{ current: null }}
      >
        Recovery
      </OverviewItemDialogSurface>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close an unregistered form", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <OverviewItemDialogSurface
        title="Recovery"
        onCancel={onClose}
        requestCloseRef={{ current: null }}
      >
        <form>
          <input aria-label="Input" />
        </form>
      </OverviewItemDialogSurface>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
