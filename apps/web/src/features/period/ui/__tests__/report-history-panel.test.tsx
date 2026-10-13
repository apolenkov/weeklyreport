// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "../../../report-sections";

vi.mock("../lead-history-list", () => ({
  LeadHistoryList: () => <div data-testid="history-list" />,
}));
vi.mock("../lead-history-sidebar", () => ({
  LeadHistorySidebar: () => <aside data-testid="history-summary" />,
}));
vi.mock("../lead-history-skeleton", () => ({
  LeadHistorySkeleton: () => <div data-testid="history-skeleton" />,
}));

import { HistoryPanel } from "../report-history-panel";

describe("HistoryPanel desktop empty composition", () => {
  it("stretches the empty state through the summary rail row", () => {
    render(
      <HistoryPanel
        entries={[] satisfies readonly HistoryEntry[]}
        includeArchive={false}
        isLoading={false}
        failure={null}
        truncated={false}
        summaryTitle="History Summary"
        isLead={false}
      />,
    );

    expect(screen.getByTestId("history-panel-grid")).toHaveClass(
      "items-stretch",
    );
    expect(screen.getByTestId("history-panel-list")).toHaveClass(
      "flex",
      "flex-col",
    );
    const emptyState = screen.getByTestId("history-empty-state");

    expect(emptyState).toHaveClass(
      "flex-1",
      "items-center",
      "justify-center",
      "bg-[var(--color-surface-empty)]",
    );
    expect(emptyState).not.toHaveClass("bg-[var(--color-card)]");
    expect(screen.getByTestId("history-summary")).toBeInTheDocument();
    expect(screen.getByText("No current history yet.")).toBeInTheDocument();
  });
});

describe("HistoryPanel compiled-history window", () => {
  it.each([true, false])(
    "discloses the latest-period window only when truncated=%s",
    (truncated) => {
      render(
        <HistoryPanel
          entries={[]}
          includeArchive
          isLoading={false}
          failure={null}
          summaryTitle="Portfolio History Summary"
          isLead={false}
          truncated={truncated}
        />,
      );
      if (truncated) {
        expect(screen.getByRole("status")).toHaveTextContent(
          "Showing the latest 100 periods.",
        );
      } else {
        expect(
          screen.queryByText("Showing the latest 100 periods."),
        ).not.toBeInTheDocument();
      }
    },
  );
});
