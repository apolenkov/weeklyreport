import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadSummaryTable } from "./lead-summary-table";
import type { LeadInfo } from "../../lib/mappers/dashboard";

describe("LeadSummaryTable", () => {
  it("D-29: renders per-lead status and content counts", () => {
    const leads: LeadInfo[] = [
      {
        id: "lead-1",
        initials: "AL",
        name: "Alice Lead",
        role: "Dev Lead",
        status: "submitted",
        trafficLights: [],
        lastActivity: "2026-05-14",
        isCurrentUser: false,
        productCount: 2,
        reportContentCount: 7,
        currentItemCount: 3,
        nextItemCount: 1,
        riskCount: 1,
        decisionCount: 2,
        priorityCount: 1,
        submittedAtLabel: "2026-05-14",
      },
      {
        id: "lead-2",
        initials: "BL",
        name: "Bob Lead",
        role: "QA Lead",
        status: "pending",
        trafficLights: [],
        lastActivity: "Not started",
        isCurrentUser: false,
        productCount: 1,
        reportContentCount: 0,
        currentItemCount: 0,
        nextItemCount: 0,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
        submittedAtLabel: null,
      },
    ];

    render(<LeadSummaryTable leads={leads} />);

    expect(
      screen.getByRole("heading", { name: "Period Summary" }),
    ).toBeVisible();
    expect(
      screen.getByText("Submitted sections and content counts by lead."),
    ).toBeVisible();

    const aliceRow = screen.getByRole("row", { name: /Alice Lead/i });
    expect(within(aliceRow).getByText("Submitted")).toBeVisible();
    expect(within(aliceRow).getAllByText("2")).toHaveLength(2);
    expect(within(aliceRow).getByText("3")).toBeVisible();
    expect(within(aliceRow).getAllByText("1")).toHaveLength(3);
    expect(within(aliceRow).getByText("2026-05-14")).toBeVisible();

    const bobRow = screen.getByRole("row", { name: /Bob Lead/i });
    expect(within(bobRow).getByText("Not started")).toBeVisible();
    expect(within(bobRow).getByText("-")).toBeVisible();
  });
});
