/**
 * a11y assertions for FillFromConfirmDialog: Escape and backdrop click both
 * call onCancel via the shared useDialogFocus primitive, and focus restores
 * to the trigger that opened it.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReportPeriod } from "../../report-sections/model/mock-data";
import { FillFromConfirmDialog } from "./fill-from-confirm-dialog";

const PERIOD: ReportPeriod = {
  id: "2026-W16",
  sourceSectionId: "sec-W16",
  weekLabel: "Week 16",
  dateRange: "Apr 14–20, 2026",
  isCurrent: false,
  isSubmitted: true,
};

const defaultProps = {
  open: true,
  selectedPeriod: PERIOD,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("FillFromConfirmDialog — a11y", () => {
  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(<FillFromConfirmDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop (role=presentation) is clicked", () => {
    const onCancel = vi.fn();
    render(<FillFromConfirmDialog {...defaultProps} onCancel={onCancel} />);

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) return;
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onCancel when clicking inside the dialog (stopPropagation)", () => {
    const onCancel = vi.fn();
    render(<FillFromConfirmDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
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
            Open
          </button>
          <FillFromConfirmDialog
            open={open}
            selectedPeriod={PERIOD}
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
