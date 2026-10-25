// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  INVISIBLE_TEXT_MESSAGE,
  NULL_BYTES_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
} from "@weeklyreport/shared";
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

  it("refuses an invisible-only reason and keeps it for correction", () => {
    const onConfirm = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const reason = screen.getByLabelText("Reason *");
    const pause = screen.getByRole("button", { name: "Pause" });
    // The server's safeText rejects invisible-only text and one such pause
    // reason would fail the whole autosave draft, so the prompt refuses it.
    fireEvent.change(reason, { target: { value: " \u200B " } });
    expect(pause).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(INVISIBLE_TEXT_MESSAGE);
    expect(reason).toHaveValue(" \u200B ");

    // Correcting the value keeps the same dialog usable.
    fireEvent.change(reason, { target: { value: "blocked upstream" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(pause).toBeEnabled();
    fireEvent.click(pause);
    expect(onConfirm).toHaveBeenCalledWith("blocked upstream");
  });

  it("refuses a null byte before it can fail the whole autosave draft", () => {
    const onConfirm = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const reason = screen.getByLabelText("Reason *");
    const pause = screen.getByRole("button", { name: "Pause" });
    // safeText rejects null bytes, and one such pause reason would fail the
    // whole autosave draft, so the prompt refuses it before confirming.
    fireEvent.change(reason, { target: { value: "blocked\u0000upstream" } });
    expect(pause).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(NULL_BYTES_MESSAGE);
    expect(reason).toHaveValue("blocked\u0000upstream");
  });

  it("counts the length limit in code points like the server schema", () => {
    const onConfirm = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const reason = screen.getByLabelText("Reason *");
    const pause = screen.getByRole("button", { name: "Pause" });

    // 500 non-BMP code points are 1000 UTF-16 units but exactly the server's
    // safeText maximum, so the prompt must accept them.
    fireEvent.change(reason, {
      target: { value: "😀".repeat(SAFE_TEXT_MAX_LENGTH) },
    });
    expect(pause).toBeEnabled();

    fireEvent.change(reason, {
      target: { value: "😀".repeat(SAFE_TEXT_MAX_LENGTH + 1) },
    });
    expect(pause).toBeDisabled();
    expect(
      screen.getByText(
        `Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`,
      ),
    ).toBeVisible();
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

  it("accepts exactly the shared safe-text limit and blocks one char over", () => {
    const onConfirm = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const reason = screen.getByLabelText("Reason *");
    const pause = screen.getByRole("button", { name: "Pause" });

    fireEvent.change(reason, {
      target: { value: "a".repeat(SAFE_TEXT_MAX_LENGTH + 1) },
    });
    expect(pause).toBeDisabled();
    expect(
      screen.getByText(
        new RegExp(
          `${SAFE_TEXT_MAX_LENGTH + 1} / ${SAFE_TEXT_MAX_LENGTH} characters`,
        ),
      ),
    ).toBeVisible();
    expect(screen.getByText(/1 over the limit/)).toBeVisible();

    fireEvent.change(reason, {
      target: { value: "a".repeat(SAFE_TEXT_MAX_LENGTH) },
    });
    expect(pause).toBeEnabled();
    fireEvent.click(pause);
    expect(onConfirm).toHaveBeenCalledWith("a".repeat(SAFE_TEXT_MAX_LENGTH));
  });

  it("measures the limit on the trimmed value that is actually confirmed", () => {
    const onConfirm = vi.fn();
    render(
      <PauseReasonDialog
        open
        preview="Implement CI pipeline"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // Raw input exceeds the limit only because of surrounding whitespace;
    // the confirmed trimmed value fits, so Pause stays enabled.
    fireEvent.change(screen.getByLabelText("Reason *"), {
      target: { value: `  ${"b".repeat(SAFE_TEXT_MAX_LENGTH)}  ` },
    });
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause).toBeEnabled();
    fireEvent.click(pause);
    expect(onConfirm).toHaveBeenCalledWith("b".repeat(SAFE_TEXT_MAX_LENGTH));
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
