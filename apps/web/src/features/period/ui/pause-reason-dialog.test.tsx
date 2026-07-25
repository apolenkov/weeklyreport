/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PauseReasonDialog } from "./pause-reason-dialog";

describe("PauseReasonDialog", () => {
  it("keeps Pause disabled until a non-blank reason is entered", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause).toBeDisabled();

    await user.type(screen.getByLabelText("Reason *"), " ".repeat(3));
    expect(pause).toBeDisabled();

    await user.type(
      screen.getByLabelText("Reason *"),
      "waiting on a dependency",
    );
    expect(pause).toBeEnabled();
  });

  it("confirms with the trimmed reason", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Reason *"), "  blocked upstream  ");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(onConfirm).toHaveBeenCalledWith("blocked upstream");
  });

  it("pre-fills the field when editing an existing reason", () => {
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        initialReason="was on hold"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Reason *")).toHaveValue("was on hold");
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <PauseReasonDialog
        open={false}
        preview="x"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PauseReasonDialog — a11y (dialog-listbox-a11y)", () => {
  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop (role=presentation) is clicked", () => {
    const onCancel = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) return;
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("traps Tab: from the last focusable control it wraps to the first", async () => {
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const reason = screen.getByLabelText("Reason *");
    const pause = screen.getByRole("button", { name: "Pause" });

    // Fill the reason so Pause is enabled and therefore focusable, making it
    // the surface's LAST focusable control.
    await userEvent.type(reason, "blocked upstream");
    pause.focus();
    expect(pause).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(reason).toHaveFocus();
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
            Pause
          </button>
          <PauseReasonDialog
            open={open}
            preview="Implement CI pipeline"
            onConfirm={vi.fn()}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).not.toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveFocus();
  });
});
