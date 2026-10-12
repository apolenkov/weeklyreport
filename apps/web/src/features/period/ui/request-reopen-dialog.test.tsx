import { MAX_REOPEN_REASON_LENGTH } from "@customreport/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

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

  it("disables the reason textarea while the request is pending so it cannot diverge from the submitted value", () => {
    renderDialog({ pending: true });

    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("keeps the reason textarea editable when not pending", () => {
    renderDialog();

    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("announces the pending send through a live status and marks the dialog busy", () => {
    renderDialog({ pending: true });

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Sending…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sending…");
  });

  it("does not mark the dialog busy when the request is not pending", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy");
  });

  it("surfaces a failed send through an alert", () => {
    renderDialog({ error: "Could not reach Head. Try again." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not reach Head. Try again.",
    );
  });

  it("blocks keyboard submit and dismissal while the request is pending", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ pending: true, onConfirm, onCancel });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "need another pass" } });

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = document.querySelector('[role="presentation"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});

describe("RequestReopenDialog — failed submit", () => {
  it("returns focus to the reason field once sending ends with an error", () => {
    const props = { onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(
      <RequestReopenDialog open pending {...props} />,
    );
    // The field is disabled while pending, so it cannot hold focus.
    expect(screen.getByLabelText(/Reason/)).toBeDisabled();
    rerender(
      <RequestReopenDialog
        open
        error="Could not send the request."
        {...props}
      />,
    );
    expect(screen.getByLabelText(/Reason/)).toHaveFocus();
  });
});

describe("RequestReopenDialog — existing reason boundary", () => {
  it.each([
    ["non-BMP boundary", "😀".repeat(500), true],
    ["non-BMP overflow", "😀".repeat(501), false],
    ["ASCII boundary", "A".repeat(500), true],
  ] as const)(
    "uses the router text metric for %s",
    async (_name, reason, accepted) => {
      const user = userEvent.setup();
      // The current requestReopen router uses this max with no extra text policy.
      expect(
        z.string().max(MAX_REOPEN_REASON_LENGTH).safeParse(reason).success,
      ).toBe(accepted);
      const onConfirm = vi.fn<(value: string | undefined) => void>();
      renderDialog({ onConfirm });
      const field = screen.getByRole("textbox", { name: /Reason/ });
      await user.click(field);
      await user.paste(reason);
      const send = screen.getByRole("button", { name: "Send request" });
      expect(field).toHaveValue(reason);
      if (accepted) {
        expect(send).toBeEnabled();
        await user.click(send);
        expect(onConfirm).toHaveBeenCalledExactlyOnceWith(reason);
      } else {
        expect(send).toBeDisabled();
        await user.keyboard("{Control>}{Enter}{/Control}");
        expect(onConfirm).not.toHaveBeenCalled();
        expect(field).toHaveValue(reason);
      }
    },
  );
});
