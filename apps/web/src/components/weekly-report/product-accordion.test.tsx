/**
 * Regression for fix-sweep-ui-findings: the priority list keyed on
 * `key={p.rank}`, so when a merged report carried duplicate ranks React logged
 * "Encountered two children with the same key" (226 occurrences in the
 * 2026-06-07 behavioral UI sweep) and could drop/duplicate items. The key now
 * disambiguates with the render index.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductReport } from "../dashboard/mock-data";
import { ProductAccordion } from "./product-accordion";

function makeReport(overrides?: Partial<ProductReport>): ProductReport {
  return {
    id: "p1",
    initials: "PA",
    name: "Product Alpha",
    status: "on-track",
    statusLabel: "On track",
    leads: "Alice",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

describe("ProductAccordion priority keys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders duplicate-rank priorities without a React key warning", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          priorities: [
            { rank: 1, text: "First priority" },
            { rank: 1, text: "Second priority" },
            { rank: 2, text: "Third priority" },
          ],
        })}
      />,
    );

    expect(screen.getByText("First priority")).toBeInTheDocument();
    expect(screen.getByText("Second priority")).toBeInTheDocument();
    expect(screen.getByText("Third priority")).toBeInTheDocument();

    const sameKeyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes("same key")),
    );
    expect(sameKeyWarning).toBeUndefined();
  });
});
