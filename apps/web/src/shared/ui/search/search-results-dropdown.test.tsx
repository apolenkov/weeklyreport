// @vitest-environment jsdom

import type { SearchHit } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchResultsDropdown } from "./search-results-dropdown";

function makeHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    type: "item",
    id: "11111111-1111-4111-8111-111111111111",
    title: "Ship v2",
    snippet: "Release checklist",
    rank: 0.5,
    projectId: "22222222-2222-4222-8222-222222222222",
    reportId: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-07-05T12:00:00.000Z",
    ...overrides,
  };
}

function renderDropdown(hits: SearchHit[]) {
  render(
    <SearchResultsDropdown
      resultsId="search-results"
      hits={hits}
      activeIndex={-1}
      isError={false}
      isFetching={false}
      isViewer={false}
      onHoverHit={vi.fn()}
      onSelectHit={vi.fn()}
    />,
  );
}

describe("SearchResultsDropdown — created date presentation", () => {
  it("renders the created date through the UTC formatter, independent of the browser timezone", () => {
    // UTC noon on Jul 5 — a +14h or -11h browser locale would shift the
    // calendar day; the app formatter pins it to the UTC date-only value.
    renderDropdown([makeHit()]);
    expect(screen.getByText("Jul 5, 2026")).toBeInTheDocument();
  });

  it("renders a boundary instant with the UTC calendar day", () => {
    // 2026-07-05T23:30:00Z is Jul 6 in a UTC+1 browser; must render Jul 5.
    renderDropdown([makeHit({ createdAt: "2026-07-05T23:30:00.000Z" })]);
    expect(screen.getByText("Jul 5, 2026")).toBeInTheDocument();
  });
});
