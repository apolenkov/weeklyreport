import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadInfo } from "../model/dashboard";
import { LeadSummaryTable } from "./lead-summary-table";

// The Remind/Revoke buttons own their own tRPC/react-query wiring; stub them so
// these tests exercise only LeadSummaryTable's gating logic (which action cell
// renders for which row), not the buttons' network behaviour.
vi.mock("./remind-lead-button", () => ({
  RemindLeadButton: () => (
    <button type="button" data-testid="remind-lead-button">
      Remind
    </button>
  ),
}));
vi.mock("./revoke-lead-button", () => ({
  RevokeSectionButton: () => (
    <button type="button" data-testid="revoke-lead-button">
      Revoke
    </button>
  ),
}));

const baseLeadSubmitted: LeadInfo = {
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
};

const baseLeadPending: LeadInfo = {
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
};

// F5 (head-surface-uat-polish): the Period Summary renders per-lead cards
// (<li>), not table rows. Resolve a lead's card by its unique name.
function leadCard(name: string): HTMLElement {
  const card = screen.getByText(name).closest("li");
  if (!card) throw new Error(`No lead card found for "${name}"`);
  return card;
}

describe("LeadSummaryTable", () => {
  it("D-29: renders per-lead status and content counts", () => {
    const leads: LeadInfo[] = [baseLeadSubmitted, baseLeadPending];

    render(<LeadSummaryTable leads={leads} />);

    expect(
      screen.getByRole("heading", { name: "Period Summary" }),
    ).toBeVisible();
    expect(
      screen.getByText("Submitted sections and content counts by lead."),
    ).toBeVisible();

    // F5 (head-surface-uat-polish): rows are now per-lead cards (<li>), not
    // table rows — query the card via the unique lead name.
    const aliceRow = leadCard("Alice Lead");
    expect(within(aliceRow).getByText("Submitted")).toBeVisible();
    expect(within(aliceRow).getAllByText("2")).toHaveLength(2);
    expect(within(aliceRow).getByText("3")).toBeVisible();
    expect(within(aliceRow).getAllByText("1")).toHaveLength(3);
    expect(within(aliceRow).getByText("2026-05-14")).toBeVisible();

    const bobRow = leadCard("Bob Lead");
    expect(within(bobRow).getByText("Not started")).toBeVisible();
    expect(within(bobRow).getByText("-")).toBeVisible();
  });

  describe("D6: per-lead Remind gate (head-dashboard-declutter)", () => {
    const draftLead: LeadInfo = {
      ...baseLeadPending,
      id: "lead-draft",
      name: "Carol Lead",
      status: "draft",
      lastActivity: "In progress",
    };
    const submittedWithSection: LeadInfo = {
      ...baseLeadSubmitted,
      id: "lead-submitted",
      reportSectionId: "section-1",
    };

    it("hides the per-lead Remind action when canSendReminder is false", () => {
      render(
        <LeadSummaryTable
          leads={[draftLead]}
          reportId="report-1"
          canSendReminder={false}
        />,
      );

      expect(
        screen.queryByTestId("remind-lead-button"),
      ).not.toBeInTheDocument();
      // Falls through to the neutral em-dash cell.
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows the Remind action for a draft row when canSendReminder is true", () => {
      render(
        <LeadSummaryTable
          leads={[draftLead]}
          reportId="report-1"
          canSendReminder
        />,
      );

      expect(screen.getByTestId("remind-lead-button")).toBeInTheDocument();
    });

    it("shows the Revoke action for a submitted row regardless of the Remind gate", () => {
      render(
        <LeadSummaryTable
          leads={[submittedWithSection]}
          reportId="report-1"
          canSendReminder={false}
        />,
      );

      expect(screen.getByTestId("revoke-lead-button")).toBeInTheDocument();
      expect(
        screen.queryByTestId("remind-lead-button"),
      ).not.toBeInTheDocument();
    });
  });

  describe("T-F4-4: 24h inactive row styling", () => {
    it("marks a 'Not started' pending row as inactive (has data-testid + opacity class)", () => {
      render(<LeadSummaryTable leads={[baseLeadPending]} />);

      const inactiveRows = screen.getAllByTestId("lead-row-inactive-24h");
      expect(inactiveRows).toHaveLength(1);
      expect(inactiveRows[0]).toHaveClass("opacity-60");
    });

    it("does NOT mark an 'In progress' draft row as inactive (lead is actively editing)", () => {
      // dashboard.ts:281-282 sets "In progress" when the lead has a draft
      // section with content but has not yet submitted. That lead is actively
      // working — the 24h-inactive gate must NOT fire.
      const lead: LeadInfo = {
        ...baseLeadPending,
        id: "lead-3",
        name: "Carol Lead",
        status: "draft",
        lastActivity: "In progress",
      };

      render(<LeadSummaryTable leads={[lead]} />);

      expect(
        screen.queryByTestId("lead-row-inactive-24h"),
      ).not.toBeInTheDocument();
    });

    it("marks a draft row with an old ISO-date (> 24h ago) as inactive", () => {
      // Uses a draft lead: the date-parsing branch only governs rows with open
      // work (a submitted row is exempt from the gate — see below).
      const lead: LeadInfo = {
        ...baseLeadPending,
        id: "lead-4",
        name: "Dan Lead",
        status: "draft",
        // 3 days ago — well past 24h
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      };

      render(<LeadSummaryTable leads={[lead]} />);

      expect(screen.getByTestId("lead-row-inactive-24h")).toBeInTheDocument();
    });

    it("does NOT mark a draft row with a recent ISO-date (< 24h ago) as inactive", () => {
      // 30 minutes ago — recent activity
      const recentIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const lead: LeadInfo = {
        ...baseLeadPending,
        id: "lead-5",
        name: "Eve Lead",
        status: "draft",
        lastActivity: recentIso,
      };

      render(<LeadSummaryTable leads={[lead]} />);

      expect(
        screen.queryByTestId("lead-row-inactive-24h"),
      ).not.toBeInTheDocument();
    });

    it("does NOT mark a SUBMITTED row as inactive even with an old date-only submittedAt (head-dashboard-declutter)", () => {
      // The seed sets submittedAt = period start (a Monday), which the mapper
      // surfaces as a date-only `lastActivity` (e.g. "2026-06-22"). Parsed at
      // local midnight, that is > 24h ago on every demo day but the first — yet
      // a submitted lead is done, not stale, so the dim/nudge gate must NOT fire.
      const oldDateOnly = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const lead: LeadInfo = {
        ...baseLeadSubmitted,
        id: "lead-6",
        name: "Frank Lead",
        status: "submitted",
        lastActivity: oldDateOnly,
        submittedAtLabel: oldDateOnly,
      };

      render(<LeadSummaryTable leads={[lead]} />);

      expect(
        screen.queryByTestId("lead-row-inactive-24h"),
      ).not.toBeInTheDocument();
    });
  });
});
