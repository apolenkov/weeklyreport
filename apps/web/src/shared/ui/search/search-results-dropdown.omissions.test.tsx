// @vitest-environment jsdom
// Search tells its reader which unfinished records the searched corpus leaves
// out, beside the results and never as a hit (openspec:
// search-contract-precision, viewer-published-search).
import { render, screen } from "@testing-library/react";
import type { RecordOmissionSummary, SearchHit } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { searchOmissionNote } from "../../lib/format/record-omission-text";
import { SearchResultsDropdown } from "./search-results-dropdown";

const HIT: SearchHit = {
  type: "risk",
  id: "11111111-1111-4111-8111-111111111111",
  title: "Vendor delay",
  snippet: "Vendor delay",
  rank: 0.5,
  reportId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-07-05T12:00:00.000Z",
};

function renderDropdown(
  omissions: RecordOmissionSummary | undefined,
  state: { hits?: SearchHit[]; isFetching?: boolean; isError?: boolean } = {},
) {
  render(
    <SearchResultsDropdown
      resultsId="search-results"
      hits={state.hits ?? []}
      omissions={omissions}
      activeIndex={-1}
      isError={state.isError ?? false}
      isFetching={state.isFetching ?? false}
      isViewer={false}
      onRetry={vi.fn()}
      onHoverHit={vi.fn()}
      onSelectHit={vi.fn()}
    />,
  );
}

const note = () =>
  screen.queryByRole("note", { name: "Records search leaves out" });

describe("searchOmissionNote", () => {
  it("says nothing when the corpus leaves nothing out", () => {
    expect(
      searchOmissionNote({ risks: 0, decisions: 0, unknown: false }),
    ).toBeNull();
  });

  it("names the kinds without claiming any of them matched", () => {
    expect(searchOmissionNote({ risks: 2, decisions: 1, unknown: false })).toBe(
      "Search leaves out 2 unfinished risks and 1 unfinished decision, still being written.",
    );
  });

  it("stays silent about reports published before counting", () => {
    expect(
      searchOmissionNote({ risks: 0, decisions: 0, unknown: true }),
    ).toBeNull();
    expect(searchOmissionNote({ risks: 1, decisions: 0, unknown: true })).toBe(
      "Search leaves out 1 unfinished risk, still being written.",
    );
  });
});

describe("SearchResultsDropdown omission note", () => {
  it("shows the note beside an empty result", () => {
    renderDropdown({ risks: 2, decisions: 0, unknown: false });

    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(note()).toHaveTextContent("Search leaves out 2 unfinished risks");
  });

  it("shows the note under the hits, outside the result list", () => {
    renderDropdown({ risks: 0, decisions: 1, unknown: false }, { hits: [HIT] });

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(note()).toHaveTextContent("1 unfinished decision");
    expect(screen.getByRole("listbox")).not.toContainElement(note());
  });

  it("shows no note when nothing is left out, or before an answer", () => {
    renderDropdown({ risks: 0, decisions: 0, unknown: false }, { hits: [HIT] });
    expect(note()).toBeNull();
  });

  it.each([{ isFetching: true }, { isError: true }])(
    "holds the note back while the answer is not current (%o)",
    (state) => {
      renderDropdown({ risks: 2, decisions: 0, unknown: false }, state);

      expect(note()).toBeNull();
    },
  );
});
