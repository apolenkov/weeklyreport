/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../lib/mappers";
import { LeadHistoryList } from "./lead-history-list";

const entry: HistoryEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  periodId: "22222222-2222-4222-8222-222222222222",
  weekLabel: "Week 20",
  dateRange: "May 11-17, 2026",
  status: "draft",
  submittedAt: null,
  createdAt: "May 15",
  lastEditAt: "2 hours ago",
  trafficLights: { green: 2, yellow: 0, red: 1 },
  itemCount: 5,
  riskCount: 1,
  decisionCount: 2,
  priorityCount: 3,
  productCount: 3,
  versionCount: 2,
  latestVersion: 2,
  latestVersionAt: "May 15",
};

describe("LeadHistoryList", () => {
  it("renders real aggregate and version metadata on each history card", () => {
    render(<LeadHistoryList entries={[entry]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/lead/report/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("Week 20, May 11-17, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Green statuses: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Yellow statuses: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Red statuses: 1")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(
      within(screen.getByText("Risks").parentElement as HTMLElement).getByText(
        "1",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Versions")).toBeInTheDocument();
    expect(screen.getByText("2 / v2")).toBeInTheDocument();
    expect(screen.getByText("Last edit")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("Latest version")).toBeInTheDocument();
    expect(screen.getByText("v2 · May 15")).toBeInTheDocument();
  });
});
