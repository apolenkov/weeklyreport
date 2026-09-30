import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrendsSection } from "./trends-section";

const baseProps = {
  headingId: "trend-heading",
  isLoading: false,
  isError: false,
  isRetrying: false,
  onRetry: vi.fn(),
  title: "Traffic-light history",
} as const;

describe("TrendsSection", () => {
  it("shows a recoverable error without losing the section heading", () => {
    const onRetry = vi.fn();
    render(
      <TrendsSection {...baseProps} isError onRetry={onRetry}>
        <p>Table data</p>
      </TrendsSection>,
    );

    expect(
      screen.getByRole("heading", { name: "Traffic-light history" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load this trend.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("announces loading and renders an explicit empty state", () => {
    const { rerender } = render(
      <TrendsSection {...baseProps} isLoading>
        <p>Table data</p>
      </TrendsSection>,
    );
    expect(screen.getByRole("status", { name: "Loading data" })).toBeVisible();

    rerender(
      <TrendsSection {...baseProps} emptyMessage="Two periods are required.">
        <p>Table data</p>
      </TrendsSection>,
    );
    expect(screen.getByText("Two periods are required.")).toBeVisible();
    expect(screen.queryByText("Table data")).not.toBeInTheDocument();
  });
});
