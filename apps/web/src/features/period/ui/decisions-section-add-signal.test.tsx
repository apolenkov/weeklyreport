// Snapshot transitions must not reopen Add decision: the addSignal effect
// skips signals already consumed via lastHandledSignal, so
// false→true→false must not re-fire.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionEntry } from "../../report-sections";
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

describe("DecisionsSection current delete permission", () => {
  const decision: DecisionEntry = {
    id: "10000000-0000-4000-8000-000000000001",
    productId: "10000000-0000-4000-8000-000000000002",
    productName: "Synthetic Product",
    text: "Select the provider",
    owner: "Synthetic Lead",
    impact: "Keeps delivery on time",
    deadline: null,
    stageNames: ["Development"],
  };
  it.each([false, true])(
    "rechecks readOnly=%s after Delete confirmation opens",
    (readOnly) => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DecisionsSection
          decisions={[decision]}
          onChange={onChange}
          readOnly={false}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: "Delete decision for Synthetic Product",
        }),
      );
      rerender(
        <DecisionsSection
          decisions={[decision]}
          onChange={onChange}
          readOnly={readOnly}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      if (readOnly) expect(onChange).not.toHaveBeenCalled();
      else expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it.each([false, true])(
    "rechecks publishedLocked=%s after Delete confirmation opens",
    (publishedLocked) => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DecisionsSection
          decisions={[decision]}
          onChange={onChange}
          publishedLockedIds={new Set<string>()}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: "Delete decision for Synthetic Product",
        }),
      );
      expect(screen.getByRole("alertdialog")).toHaveTextContent(decision.text);
      rerender(
        <DecisionsSection
          decisions={[decision]}
          onChange={onChange}
          publishedLockedIds={new Set(publishedLocked ? [decision.id] : [])}
        />,
      );
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: /^Delete$/,
        }),
      );
      if (publishedLocked) expect(onChange).not.toHaveBeenCalled();
      else expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    },
  );
  it("keeps editable Cancel inert", () => {
    const onChange = vi.fn();
    render(<DecisionsSection decisions={[decision]} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete decision for Synthetic Product",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
