/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../lib/mappers";
import { LeadHistoryList } from "./lead-history-list";

const entry: HistoryEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  periodId: "22222222-2222-4222-8222-222222222222",
  weekLabel: "Week 20",
  dateRange: "May 11-17, 2026",
  status: "draft",
  archived: false,
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
  it("renders a compact history card with dates and traffic-light counts", () => {
    render(<LeadHistoryList entries={[entry]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/lead/report/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("Week 20, May 11-17, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Green statuses: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Yellow statuses: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Red statuses: 1")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 green statuses, 1 red status | 5 items | 1 risk | 2 decisions",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Last edit")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    expect(screen.queryByText("Products")).not.toBeInTheDocument();
    expect(screen.queryByText("Versions")).not.toBeInTheDocument();
  });

  describe("TrafficDot ARIA — role=img on span wrapper", () => {
    it("green traffic dot has role=img", () => {
      render(<LeadHistoryList entries={[entry]} />);
      expect(
        screen.getByRole("img", { name: "Green statuses: 2" }),
      ).toBeInTheDocument();
    });

    it("yellow traffic dot has role=img", () => {
      render(<LeadHistoryList entries={[entry]} />);
      expect(
        screen.getByRole("img", { name: "Yellow statuses: 0" }),
      ).toBeInTheDocument();
    });

    it("red traffic dot has role=img", () => {
      render(<LeadHistoryList entries={[entry]} />);
      expect(
        screen.getByRole("img", { name: "Red statuses: 1" }),
      ).toBeInTheDocument();
    });

    it("all three traffic dots are exposed in a11y tree as images with correct labels", () => {
      render(<LeadHistoryList entries={[entry]} />);
      const dots = screen.getAllByRole("img");
      expect(dots).toHaveLength(3);
      const names = dots.map((el) => el.getAttribute("aria-label"));
      expect(names).toContain("Green statuses: 2");
      expect(names).toContain("Yellow statuses: 0");
      expect(names).toContain("Red statuses: 1");
    });
  });
});
