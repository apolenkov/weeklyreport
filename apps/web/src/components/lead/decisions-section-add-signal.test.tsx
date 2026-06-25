/**
 * D1 regression: snapshot view transitions must not reopen the Add Decision dialog.
 *
 * Covers the decisions-section copy of the addSignal snapshot bug
 * (fix-section-add-signal-reset, task 1.2): when readOnly flips
 * false → true → false the addSignal effect must NOT re-fire because
 * readOnly is no longer in the dep array.
 *
 * Scenario (mirrors current-week-section-add-signal.test.tsx):
 *   1. addSignal=1, readOnly=false  → dialog opens
 *   2. User cancels dialog           → dialog closes; addSignal stays at 1
 *   3. readOnly=true  (snapshot)     → no dialog re-open (guard fires in body)
 *   4. readOnly=false (back to live) → must NOT reopen; only a new increment should
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionsSection } from "./decisions-section";

describe("DecisionsSection — addSignal snapshot regression (D1)", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: counter starts idle at 0 (parent's initial state); the "+ Add"
    // click advances it 0→1 → effect fires, dialog opens. (Mounting straight at
    // a non-zero signal models a remount, which must NOT auto-open — D16.)
    const { rerender } = render(
      <DecisionsSection decisions={[]} addSignal={0} readOnly={false} />,
    );
    rerender(
      <DecisionsSection decisions={[]} addSignal={1} readOnly={false} />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Step 2: user cancels the dialog (same signal, counter not reset by parent).
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 3: enter snapshot view — readOnly=true, addSignal still 1.
    rerender(<DecisionsSection decisions={[]} addSignal={1} readOnly={true} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 4: return to live view — readOnly=false, addSignal still 1.
    // The key assertion: the effect must NOT re-fire on the readOnly transition.
    rerender(
      <DecisionsSection decisions={[]} addSignal={1} readOnly={false} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
