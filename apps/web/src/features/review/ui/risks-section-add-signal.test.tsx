// readOnly must stay out of the addSignal effect deps, or a snapshot flip
// re-fires the effect and re-opens the dialog on a stale signal.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "../../../test-utils/mock-products";
import { RisksSection } from "./risks-section";

const products = MOCK_PRODUCTS.slice(0, 1);

describe("RisksSection — addSignal snapshot regression", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Start idle at 0 then advance 0→1 so the effect opens; mounting at a
    // non-zero signal models a remount and must not auto-open.
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

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addSignal={1}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Live again with the same signal — effect must not re-fire on readOnly.
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

  // addPrefill is a separate create-open source from addSignal, with its own
  // monotonic signal the form owner never resets on view transitions — so the
  // hook's readOnly-ref guard is the only thing preventing a stale reopen.
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
