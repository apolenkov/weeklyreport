// Add commands are monotonic; read-only transitions must not replay them.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "../../../test-utils/mock-products";
import { RisksSection } from "./risks-section";

const products = MOCK_PRODUCTS.slice(0, 1);

describe("RisksSection — addSignal snapshot regression", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Advance the command to open the dialog.
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

    // Returning to editing with the same command must not reopen it.
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

  // Prefilled add commands follow the same replay rule.
  it("does not reopen the dialog when readOnly toggles false→true→false with a stale addPrefill", () => {
    const firstProductId = products[0]?.id ?? "";
    const prefill = {
      signal: 1,
      productId: firstProductId,
      stageNames: ["Dev"],
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

    rerender(
      <RisksSection
        risks={[]}
        products={products}
        addPrefill={prefill}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

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
