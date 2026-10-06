import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadInfo } from "../model/dashboard";
import { LeadSummaryTable } from "./lead-summary-table";

vi.mock("./lead-queue-actions", async () => {
  const { primaryAction } = await import("../model/dashboard-leads");
  const actionLabels = {
    review: "Review",
    open: "Open",
    remind: "Remind",
    none: "Read only",
  } as const;
  return {
    LeadPrimaryAction: ({ lead }: { lead: LeadInfo }) => (
      <button type="button">{actionLabels[primaryAction(lead)]}</button>
    ),
    LeadSecondaryActions: () => <button type="button">Secondary action</button>,
  };
});

function makeLead(overrides: Partial<LeadInfo> = {}): LeadInfo {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    initials: "AL",
    name: "Alice Lead",
    role: "lead",
    status: "draft",
    trafficLights: [{ status: "at-risk", icon: "!" }],
    lastEditAt: new Date(),
    submittedAt: null,
    isStale: false,
    isCurrentUser: false,
    productCount: 2,
    reportContentCount: 3,
    currentItemCount: 2,
    nextItemCount: 1,
    riskCount: 1,
    decisionCount: 1,
    priorityCount: 1,
    activityCount: 2,
    submittedAtLabel: null,
    reportSectionId: "30000000-0000-4000-8000-000000000001",
    version: 2,
    reviews: [],
    reviewState: "none",
    reviewLabel: "Not reviewed",
    attentionLabel: "At risk",
    actions: {
      canOpen: true,
      canRemind: true,
      canReview: false,
      canRequestChanges: false,
      canRevoke: false,
    },
    priority: "active",
    ...overrides,
    reminderRuleId:
      overrides.reminderRuleId === undefined
        ? "40000000-0000-4000-8000-000000000001"
        : overrides.reminderRuleId,
  };
}

function leadRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`No queue row found for ${name}`);
  return row;
}

describe("LeadSummaryTable action queue", () => {
  it.each([
    ["submitted", "none", "Not reviewed"],
    ["draft", "changes-requested", "Changes requested"],
  ] as const)(
    "shows the review pill for a %s section in review state %s",
    (status, reviewState, reviewLabel) => {
      render(
        <LeadSummaryTable
          leads={[makeLead({ status, reviewState, reviewLabel })]}
          reportId="10000000-0000-4000-8000-000000000001"
          onMutated={vi.fn()}
        />,
      );
      // R29: the pill carries the same outline as the status badge beside it.
      expect(within(leadRow("Alice Lead")).getByText(reviewLabel)).toHaveClass(
        "border",
        "text-[var(--color-foreground)]",
      );
    },
  );

  it("renders one compact row with identity, state, freshness, attention, and primary action", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead()]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Period Summary" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "One action queue ordered by review need, freshness, and completion.",
      ),
    ).toBeVisible();
    const row = leadRow("Alice Lead");
    expect(within(row).queryByText("Lead")).toBeNull();
    expect(within(row).getByText("In progress")).toBeVisible();
    expect(within(row).queryByText("Not reviewed")).toBeNull();
    expect(within(row).getByText(/5 records · At risk/)).toBeVisible();
    const primaryAction = within(row).getByRole("button", { name: "Open" });
    expect(primaryAction).toBeVisible();
    expect(primaryAction.parentElement).toHaveClass(
      "w-[var(--dashboard-summary-action-w)]",
      "max-sm:flex-1",
      "[&>button]:w-full",
    );
    expect(within(row).queryByText("Products")).not.toBeInTheDocument();
  });

  it("names the author role only when the row is not a lead", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead({ name: "Heidi Head", role: "head" })]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    expect(within(leadRow("Heidi Head")).getByText("Head")).toBeVisible();
  });

  it("puts the primary action and Details side by side below lg", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead()]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "Details for Alice Lead",
    });
    const actionLine = toggle.parentElement;
    expect(actionLine).toHaveClass("flex", "max-lg:col-span-2", "lg:contents");
    expect(actionLine).toContainElement(
      within(leadRow("Alice Lead")).getByRole("button", { name: "Open" }),
    );
    expect(toggle).toHaveClass("max-sm:flex-1", "border");
  });

  it("exposes expanded detail through a linked disclosure and preserves toggle focus", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead()]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Details for Alice Lead",
    });
    expect(toggle).toHaveClass(
      "h-[var(--dashboard-action-h)]",
      "w-[var(--dashboard-summary-action-w)]",
    );
    const detailId = toggle.getAttribute("aria-controls");
    if (!detailId) throw new Error("Disclosure is missing aria-controls");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide details for Alice Lead");
    expect(toggle).toHaveClass(
      "h-[var(--dashboard-action-h)]",
      "w-[var(--dashboard-summary-action-w)]",
    );
    expect(document.getElementById(detailId)).toBeVisible();
    expect(screen.getByText("Products")).toBeVisible();
    expect(screen.getByText("Activities")).toBeVisible();
    expect(screen.getByText("Not reviewed · 0 verdicts")).toBeVisible();
    toggle.focus();
    expect(toggle).toHaveFocus();
  });

  it("uses stacked, clipped-safe rows and marks stale open work without dimming it", () => {
    render(
      <LeadSummaryTable
        leads={[
          makeLead({
            id: "20000000-0000-4000-8000-000000000002",
            name: "Stella Stale",
            lastEditAt: null,
            isStale: true,
            priority: "stale",
          }),
        ]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    const row = leadRow("Stella Stale");
    expect(row).toHaveClass("min-w-0", "overflow-hidden");
    expect(row).toHaveClass("border-[var(--color-warning)]");
    expect(row).toHaveAttribute("data-priority", "stale");
    expect(row).toHaveTextContent("No recent edit · Needs attention");
  });

  // R77: the Submissions card counts every lead in the report; the queue lists
  // only the leads in the viewer's scope, so the badge must state the gap
  // instead of contradicting the card.
  it("states that the queue covers fewer leads than the Submissions card", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead()]}
        expectedLeads={3}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    const badge = screen.getByText("1 of 3 leads");
    expect(badge).toHaveAttribute(
      "title",
      "Queue lists the 1 lead in your scope; the Submissions card counts all 3",
    );
  });

  it("keeps the plain count when every expected lead is listed", () => {
    render(
      <LeadSummaryTable
        leads={[makeLead()]}
        expectedLeads={1}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    expect(screen.getByText("1 lead")).not.toHaveAttribute("title");
  });

  it("renders an empty queue without a second roster", () => {
    render(
      <LeadSummaryTable
        leads={[]}
        reportId="10000000-0000-4000-8000-000000000001"
        onMutated={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No lead rows for the current period."),
    ).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
