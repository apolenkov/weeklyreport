/**
 * Snapshot view transitions must not reopen the Add Decision dialog:
 * readOnly is out of the addSignal effect deps, so false→true→false must not re-fire.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionsSection } from "./decisions-section";

describe("DecisionsSection — addSignal snapshot regression", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: counter starts idle at 0 (parent's initial state); the "+ Add"
    // click advances it 0→1 → effect fires, dialog opens. Mounting straight at
    // a non-zero signal models a remount, which must NOT auto-open.
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
