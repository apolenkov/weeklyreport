/**
 * a11y assertions for RequestReopenDialog: Escape/Cancel/backdrop close,
 * stopPropagation on the inner surface, and autofocus on the textarea.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RequestReopenDialog } from "./request-reopen-dialog";

function renderDialog(
  props?: Partial<React.ComponentProps<typeof RequestReopenDialog>>,
) {
  return render(
    <RequestReopenDialog
      open={true}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
}

describe("RequestReopenDialog — a11y regression", () => {
  it("calls onCancel when Escape is pressed on the backdrop div", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("backdrop div has role='presentation'", () => {
    renderDialog();

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).toHaveAttribute("role", "presentation");
  });

  it("does NOT call onCancel when clicking inside the inner dialog div (stopPropagation)", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed while focus is on the textarea (event bubbles to backdrop)", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop itself is clicked (positive polarity for stopPropagation test)", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("autofocuses the textarea when the dialog opens", async () => {
    renderDialog();

    // Focus is deferred via requestAnimationFrame; wait for it to settle.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("textbox"));
    });
  });
});
