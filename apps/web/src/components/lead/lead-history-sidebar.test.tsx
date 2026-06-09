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
    versionCount: 0,
    latestVersion: null,
    latestVersionAt: null,
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
});
