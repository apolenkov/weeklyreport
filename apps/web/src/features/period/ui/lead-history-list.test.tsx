// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../report-sections";
import { LeadHistoryList } from "./lead-history-list";

const entry: HistoryEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  periodId: "22222222-2222-4222-8222-222222222222",
  weekLabel: "Week 20",
  dateRange: "May 11-17, 2026",
  status: "draft",
  archived: false,
  submissionState: "not-submitted",
  submittedAt: null,
  createdAt: "May 15",
  createdAtTitle: "May 15, 2026, 9:00 AM",
  lastEditAt: "2 hours ago",
  lastEditAtTitle: "May 17, 2026, 3:00 PM",
  trafficLights: { green: 2, yellow: 0, red: 1 },
  itemCount: 5,
  riskCount: 1,
  decisionCount: 2,
  priorityCount: 3,
  productCount: 3,
};

describe("LeadHistoryList", () => {
  it("renders a compact history card with dates and traffic-light counts", () => {
    render(<LeadHistoryList entries={[entry]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/lead/report/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("Week 20, May 11-17, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("On track statuses: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("At risk statuses: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Blocked statuses: 1")).toBeInTheDocument();
    // Status counts stay readable without color vision.
    expect(screen.getByText("2 on track")).toBeVisible();
    expect(screen.getByText("0 at risk")).toBeVisible();
    expect(screen.getByText("1 blocked")).toBeVisible();
    expect(
      screen.getByText(
        "2 on track, 1 blocked · 5 items · 1 risk · 2 decisions",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Last edit")).toBeInTheDocument();
    const lastEdit = screen.getByText("2 hours ago");
    expect(lastEdit).toBeInTheDocument();
    expect(lastEdit).toHaveAttribute("title", "May 17, 2026, 3:00 PM");
    expect(screen.queryByText("Products")).not.toBeInTheDocument();
    expect(screen.queryByText("Versions")).not.toBeInTheDocument();
  });

  it("shows the publication time even when a submission exists", () => {
    render(
      <LeadHistoryList
        entries={[
          {
            ...entry,
            status: "submitted",
            submissionState: "submitted",
            submittedAt: "3 hours ago",
            publishedAt: "1 hour ago",
          },
        ]}
      />,
    );

    expect(screen.getByText("3 hours ago")).toBeInTheDocument();
    expect(screen.getAllByText("Published")).not.toHaveLength(0);
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
  });

  it("does not claim a compiled published period was not submitted", () => {
    render(
      <LeadHistoryList
        entries={[
          {
            ...entry,
            status: "published",
            submissionState: "unavailable",
            publishedAt: "1 hour ago",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Published")).not.toHaveLength(0);
    expect(screen.queryByText("Not submitted")).not.toBeInTheDocument();
  });

  it("exposes each traffic dot in the a11y tree as an image with its count label", () => {
    render(<LeadHistoryList entries={[entry]} />);

    const dots = screen.getAllByRole("img");
    expect(dots).toHaveLength(3);
    for (const name of [
      "On track statuses: 2",
      "At risk statuses: 0",
      "Blocked statuses: 1",
    ]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
  });

  it("labels a reopened period as reopened with its last publication time", () => {
    render(
      <LeadHistoryList
        entries={[
          {
            ...entry,
            status: "reopened",
            reopened: true,
            publishedAt: "8 min ago",
          },
        ]}
      />,
    );

    expect(screen.getByText("Reopened")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.getByText("Last published")).toBeInTheDocument();
    expect(screen.getByText("8 min ago")).toBeInTheDocument();
  });

  it("keeps Last published for a resubmitted section of a reopened period", () => {
    render(
      <LeadHistoryList
        entries={[
          {
            ...entry,
            status: "submitted",
            reopened: true,
            publishedAt: "8 min ago",
          },
        ]}
      />,
    );

    expect(screen.queryByText("Reopened")).not.toBeInTheDocument();
    expect(screen.getByText("Last published")).toBeInTheDocument();
  });
});
