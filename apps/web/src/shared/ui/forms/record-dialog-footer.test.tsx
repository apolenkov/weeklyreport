// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordDialogFooter } from "./record-dialog-footer";

describe("RecordDialogFooter", () => {
  it("communicates and blocks a pending save", () => {
    const onSave = vi.fn();
    render(
      <RecordDialogFooter
        saveLabel="Save item"
        onCancel={vi.fn()}
        onSave={onSave}
        savePending
      />,
    );

    const save = screen.getByRole("button", { name: "Saving…" });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");

    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("still supports a disabled save before submission starts", () => {
    render(
      <RecordDialogFooter
        saveLabel="Save item"
        onCancel={vi.fn()}
        onSave={vi.fn()}
        saveDisabled
      />,
    );

    expect(screen.getByRole("button", { name: "Save item" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
