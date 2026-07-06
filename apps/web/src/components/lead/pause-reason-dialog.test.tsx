/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
