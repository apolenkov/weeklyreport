/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../lib/mappers";
import { LeadHistorySidebar } from "./lead-history-sidebar";

function makeEntry(
  status: HistoryEntry["status"],
  index: number,
): HistoryEntry {
  return {
    id: `id-${index}`,
    periodId: `period-${index}`,
    weekLabel: `Week ${20 + index}`,
    dateRange: "May 11-17, 2026",
    status,
    archived: status === "archived",
    submittedAt: null,
    createdAt: null,
    lastEditAt: null,
    trafficLights: { green: 1, yellow: 0, red: 0 },
    itemCount: 3,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    productCount: 1,
  };
}

describe("LeadHistorySidebar completed-week stats", () => {
  // Regression: compiled (head/viewer) history entries carry "published" /
  // "archived" status, never "submitted". Before the driver-sweep fix the
  // summary filtered on status === "submitted" only, so every compiled stat
  // read 0/N and 0% even when all displayed weeks were published.
  it("counts published/archived compiled weeks as completed (viewerMode)", () => {
    const entries: HistoryEntry[] = [
      makeEntry("published", 0),
      makeEntry("published", 1),
      makeEntry("archived", 2),
      makeEntry("published", 3),
      makeEntry("published", 4),
    ];

    render(<LeadHistorySidebar entries={entries} viewerMode />);

    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    // Streak counts consecutive completed weeks from the top of the list.
    expect(screen.getByText(/Submitted/i, { selector: "p" })).toHaveTextContent(
      "Submitted 5 weeks in a row.",
    );
    expect(screen.queryByText(/still a draft/i)).not.toBeInTheDocument();
  });

  it("still counts lead personal submitted weeks and breaks streak on draft", () => {
    const entries: HistoryEntry[] = [
      makeEntry("submitted", 0),
      makeEntry("submitted", 1),
      makeEntry("draft", 2),
      makeEntry("submitted", 3),
    ];

    render(<LeadHistorySidebar entries={entries} />);

    // 3 of 4 weeks completed -> 75%.
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    // Streak stops at the first draft -> 2 consecutive submitted weeks.
    expect(screen.getByText(/Submitted/i, { selector: "p" })).toHaveTextContent(
      "Submitted 2 weeks in a row.",
    );
  });

  it("shows the empty state when there is no history", () => {
    render(<LeadHistorySidebar entries={[]} viewerMode />);

    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText("No history yet.")).toBeInTheDocument();
  });

  it("excludes draft entries from aggregates but keeps them in the Submissions denominator", () => {
    const submittedA = makeEntry("submitted", 0);
    // submitted entry: trafficLights.green=1, itemCount=3, riskCount=0

    const submittedB: HistoryEntry = {
      ...makeEntry("submitted", 1),
      trafficLights: { green: 0, yellow: 1, red: 0 },
      itemCount: 5,
      riskCount: 2,
    };

    const draft: HistoryEntry = {
      ...makeEntry("draft", 2),
      trafficLights: { green: 0, yellow: 0, red: 3 },
      itemCount: 100,
      riskCount: 99,
    };

    render(<LeadHistorySidebar entries={[submittedA, submittedB, draft]} />);

    // Submissions: 2 completed out of 3 total
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();

    // avgItems: (3 + 5) / 2 = 4, NOT (3 + 5 + 100) / 3 = 36
    expect(screen.getByText("4")).toBeInTheDocument();

    // totalRisks: 0 + 2 = 2, NOT 0 + 2 + 99 = 101
    // The Stat tile structure: outer div > value div + label div.
    // Navigate from the label up to the tile container, then get the first child (value).
    const risksLabel = screen.getByText("Total risks");
    const statTile = risksLabel.parentElement;
    expect(statTile?.firstElementChild).toHaveTextContent("2");

    // Traffic-light footer: green=1, yellow=1, red=0 (draft's red=3 excluded)
    const aside = screen.getByRole("complementary");
    // The footer renders three <span> counts; the muted "blocked" advisory
    // should NOT appear because red=0 for submitted entries only.
    expect(aside.textContent).not.toMatch(/blocked traffic-light/i);

    // Draft note is visible
    expect(screen.getByText(/1 draft not included/i)).toBeInTheDocument();

    // Traffic-light footer denominator counts only the aggregated (completed)
    // periods, matching the numerator — "across 2 periods", NOT "across 3".
    expect(aside.textContent).toMatch(/across 2 periods/);
    expect(aside.textContent).not.toMatch(/across 3 periods/);
  });

  it("shows no draft note when all entries are submitted", () => {
    const entries: HistoryEntry[] = [
      makeEntry("submitted", 0),
      makeEntry("submitted", 1),
    ];

    render(<LeadHistorySidebar entries={entries} />);

    expect(screen.queryByText(/draft.*not included/i)).not.toBeInTheDocument();
  });
});
