import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DialogSurface } from "../../ui/dialogs/dialog-surface";
import { useDialogFocus } from "./use-dialog-focus";

function PendingDialog({ pending }: { readonly pending: boolean }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, onClose: vi.fn(), containerRef: surfaceRef });
  return (
    <>
      <button type="button">Background before</button>
      <DialogSurface
        surfaceRef={surfaceRef}
        onDismiss={vi.fn()}
        surfaceClassName=""
        ariaLabel="Pending form"
      >
        <fieldset disabled={pending}>
          <input aria-label="Pending field" />
          <button type="button">Save</button>
        </fieldset>
      </DialogSurface>
      <button type="button">Background after</button>
    </>
  );
}

function Dialog({
  onClose,
  autoFocusField,
  label = "field",
}: {
  onClose: () => void;
  autoFocusField: boolean;
  label?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, onClose, containerRef: surfaceRef });
  return (
    <div ref={surfaceRef}>
      {/* A ref callback focuses this field during commit — before the hook's
          effect runs — reproducing the ordering a real inner `autoFocus`
          produces (jsdom does not apply the autoFocus attribute itself). */}
      <input
        aria-label={label}
        ref={
          autoFocusField
            ? (el) => {
                el?.focus();
              }
            : undefined
        }
      />
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function Harness({ autoFocusField }: { autoFocusField: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? (
        <Dialog
          onClose={() => setOpen(false)}
          autoFocusField={autoFocusField}
        />
      ) : null}
    </>
  );
}

function CustomDialog({
  label,
  onClose,
  children,
}: {
  readonly label: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, onClose, containerRef: surfaceRef });
  return (
    <div ref={surfaceRef} role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>
  );
}

function NestedCustomDialogHarness() {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(false);
  if (!outerOpen) return <p>Closed</p>;
  return (
    <CustomDialog label="Outer dialog" onClose={() => setOuterOpen(false)}>
      <button type="button" onClick={() => setInnerOpen(true)}>
        Open inner
      </button>
      {innerOpen ? (
        <CustomDialog label="Inner dialog" onClose={() => setInnerOpen(false)}>
          <button type="button">Inner action</button>
        </CustomDialog>
      ) : null}
    </CustomDialog>
  );
}

describe("useDialogFocus focus restore", () => {
  it("restores focus to the trigger when a plain dialog closes", () => {
    render(<Harness autoFocusField={false} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    // The hook pulled focus into the surface (no inner autofocus held it).
    expect(document.activeElement).not.toBe(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("restores focus to the trigger even when the surface auto-focuses a field", () => {
    render(<Harness autoFocusField={true} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    // The inner field grabbed focus before the hook's effect (autofocus order),
    // so the effect cannot read the trigger — the render-time opener capture is
    // what makes restore work. Without it, focus would drop to <body>.
    expect(document.activeElement).toBe(screen.getByLabelText("field"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps focus inside without restoring the opener during an open rerender", () => {
    function RerenderHarness() {
      const [label, setLabel] = useState("first field");
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open ? (
            <>
              <Dialog
                onClose={() => setOpen(false)}
                autoFocusField={true}
                label={label}
              />
              <button type="button" onClick={() => setLabel("renamed field")}>
                Rerender
              </button>
            </>
          ) : null}
        </>
      );
    }

    render(<RerenderHarness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    const field = screen.getByLabelText("first field");
    expect(field).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Rerender" }));

    expect(screen.getByLabelText("renamed field")).toHaveFocus();
  });
});

describe("useDialogFocus keyboard handling", () => {
  it.each([false, true])(
    "contains Tab with all fields disabled (shift=%s) and resumes after settlement",
    async (shift) => {
      const user = userEvent.setup();
      const { rerender } = render(<PendingDialog pending={false} />);
      screen.getByRole("button", { name: "Save" }).focus();
      rerender(<PendingDialog pending />);
      expect(screen.getByLabelText("Pending field")).toBeDisabled();

      await user.tab({ shift });
      expect(
        screen.getByRole("dialog", { name: "Pending form" }),
      ).toHaveFocus();
      await user.tab({ shift });
      expect(
        screen.getByRole("dialog", { name: "Pending form" }),
      ).toHaveFocus();

      rerender(<PendingDialog pending={false} />);
      await user.tab({ shift });
      expect(
        shift
          ? screen.getByRole("button", { name: "Save" })
          : screen.getByLabelText("Pending field"),
      ).toHaveFocus();
    },
  );

  it("focuses the surface when a dialog opens with no enabled controls", () => {
    render(<PendingDialog pending />);
    expect(screen.getByRole("dialog", { name: "Pending form" })).toHaveFocus();
  });

  it("wraps focus in both directions at the dialog boundaries", () => {
    render(<Harness autoFocusField={false} />);
    fireEvent.click(screen.getByTestId("trigger"));

    const first = screen.getByLabelText("field");
    const last = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("pulls focus back inside after a content swap unmounts the focused element", () => {
    function SwapHarness() {
      const [showPanel, setShowPanel] = useState(false);
      const [open, setOpen] = useState(true);
      const surfaceRef = useRef<HTMLDivElement>(null);
      useDialogFocus({
        open,
        onClose: () => setOpen(false),
        containerRef: surfaceRef,
      });
      return (
        <div ref={surfaceRef}>
          {showPanel ? (
            <button type="button" onClick={() => setShowPanel(false)}>
              Back
            </button>
          ) : (
            <button
              type="button"
              data-testid="panel-one"
              onClick={() => setShowPanel(true)}
            >
              Next panel
            </button>
          )}
        </div>
      );
    }
    render(<SwapHarness />);

    // Focus the first-panel control, then swap panels so it unmounts. The
    // unmounted element is no longer inside the container, so Tab must pull
    // focus back to the new first focusable instead of escaping the dialog.
    const panelOne = screen.getByTestId("panel-one");
    panelOne.focus();
    expect(document.activeElement).toBe(panelOne);
    fireEvent.click(panelOne);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    // Tab must pull focus back into the container instead of escaping it.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} autoFocusField={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores an Escape already claimed by an earlier keyboard owner", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} autoFocusField={false} />);
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("gives a nested custom dialog the first Escape", async () => {
    const user = userEvent.setup();
    render(<NestedCustomDialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open inner" }));
    expect(screen.getByRole("dialog", { name: "Inner dialog" })).toBeVisible();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Inner dialog" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).toBeVisible();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Outer dialog" }),
    ).not.toBeInTheDocument();
  });
});
