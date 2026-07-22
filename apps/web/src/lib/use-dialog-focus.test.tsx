import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDialogFocus } from "./use-dialog-focus";

function Dialog({
  onClose,
  autoFocusField,
}: {
  onClose: () => void;
  autoFocusField: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, onClose, containerRef: surfaceRef });
  return (
    <div ref={surfaceRef}>
      {/* A ref callback focuses this field during commit — before the hook's
          effect runs — reproducing the ordering a real inner `autoFocus`
          produces (jsdom does not apply the autoFocus attribute itself). */}
      <input
        aria-label="field"
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
});

describe("useDialogFocus keyboard handling", () => {
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

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} autoFocusField={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
