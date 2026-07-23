/**
 * Snapshot view transitions must not reopen the Add Risk dialog: readOnly
 * must stay out of the addSignal effect's dep array, or a snapshot flip
 * (false → true → false) re-fires the effect and re-opens the dialog.
 *
 * Scenario (mirrors current-week-section-add-signal.test.tsx):
 *   1. addSignal=1, readOnly=false  → dialog opens
 *   2. User cancels dialog           → dialog closes; addSignal stays at 1
 *   3. readOnly=true  (snapshot)     → no dialog re-open (guard fires in body)
 *   4. readOnly=false (back to live) → must NOT reopen; only a new increment should
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "../../report-sections";
import { RisksSection } from "./risks-section";

const products = MOCK_PRODUCTS.slice(0, 1);

describe("RisksSection — addSignal snapshot regression", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: counter starts idle at 0 (parent's initial state); the "+ Add"
    // click advances it 0→1 → effect fires, dialog opens. Mounting straight at
    // a non-zero signal models a remount, which must NOT auto-open.
    const { rerender } = render(
      <RisksSection
        risks={[]}
        products={products}
        addSignal={0}
        readOnly={false}
      />,
    );
    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addSignal={1}
        readOnly={false}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Step 2: user cancels the dialog (same signal, counter not reset by parent).
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 3: enter snapshot view — readOnly=true, addSignal still 1.
    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addSignal={1}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 4: return to live view — readOnly=false, addSignal still 1.
    // The key assertion: the effect must NOT re-fire on the readOnly transition.
    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addSignal={1}
        readOnly={false}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The chip-raise interception (addPrefill) is a SEPARATE create-open source
  // from addSignal, with its own monotonic signal that the form owner does NOT
  // reset on view transitions. The hook's readOnly-ref guard must keep it from
  // reopening the dialog when readOnly toggles false→true→false with a stale
  // prefill.
  it("does not reopen the dialog when readOnly toggles false→true→false with a stale addPrefill", () => {
    const firstProductId = products[0]?.id ?? "";
    const prefill = {
      signal: 1,
      productId: firstProductId,
      stageIds: ["Dev"],
      severity: "blocked" as const,
    };

    const { rerender } = render(
      <RisksSection
        risks={[]}
        products={products}
        addPrefill={prefill}
        readOnly={false}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Enter snapshot view — same stale prefill (signal still 1).
    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addPrefill={prefill}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Return to live view — the chip-raise effect must NOT re-fire on the
    // readOnly transition (openCreate is identity-stable across readOnly).
    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addPrefill={prefill}
        readOnly={false}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
