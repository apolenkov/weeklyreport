// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/ui/report-shell/accordion-section", () => ({
  AccordionSection: ({
    subtitle,
    actions,
    children,
  }: {
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <p>{subtitle}</p>
      {actions}
      {children}
    </section>
  ),
}));
vi.mock("../../../../period", () => ({ CurrentWeekSection: () => null }));
vi.mock("../../../../report-sections", () => ({
  NextWeekSection: () => null,
  UnifiedActivitySection: ({
    activities,
    addSignal,
  }: {
    activities?: readonly { id: string; name: string }[];
    addSignal?: number;
  }) => (
    <div data-add-signal={addSignal} data-testid="unified-host">
      {activities?.map((activity) => activity.name).join(",")}
    </div>
  ),
}));

import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import {
  LeadFormItemSections,
  type LeadFormItemSectionsActions,
} from "./lead-form-item-sections";

const actions: LeadFormItemSectionsActions = {
  onCurrentWeekItemsChange: vi.fn(),
  onNextWeekItemsChange: vi.fn(),
  onMarkComplete: vi.fn(),
  onMoveToNextWeek: vi.fn(),
  onContinueToNext: vi.fn(),
  onMoveToCurrentWeek: vi.fn(),
  onPauseItem: vi.fn(),
  addCurrentWeekItem: vi.fn(),
  addNextWeekItem: vi.fn(),
  currentWeekAddSignal: 0,
  nextWeekAddSignal: 0,
};

function unifiedViewModel(readOnly: boolean): LeadFormLoadedViewModel {
  return {
    activityOptions: [
      { id: "activity-a", name: "Hiring" },
      { id: "activity-b", name: "Triage" },
    ],
    currentUser: {
      name: "Lead 1",
      initials: "L1",
      role: "Lead",
      authorRole: "lead",
    },
    ownCurrentWeekItems: [],
    ownNextWeekItems: [],
    ownRisks: [],
    ownDecisions: [],
    activityCards: [],
    currentWeekItems: [],
    nextWeekItems: [],
    decisions: [],
    isReadOnly: readOnly,
    ownPeriodRanks: [],
    products: [],
    publishedLockedItemIds: new Set(),
    publishedLockedDecisionIds: new Set(),
    fillFromLocked: false,
    risks: [],
    unifiedEntries: [],
    canRequestReopen: false,
    hasArchivedPeriods: false,
    visiblePeriods: [],
  };
}

describe("LeadFormItemSections — unified activity adapter", () => {
  it("passes activity parents and removes unavailable Add copy when readonly", () => {
    render(
      <LeadFormItemSections
        unifiedView
        viewModel={unifiedViewModel(true)}
        actions={actions}
        groupExpanded
        stagesForProduct={() => []}
      />,
    );

    expect(screen.getByTestId("unified-host")).toHaveTextContent(
      "Hiring,Triage",
    );
    expect(
      screen.getByText(
        "Current and next week items in one list, grouped by state.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/\+ Add/)).toBeNull();
  });

  it("offers one local Add Item action wired to the current-week signal", () => {
    const addCurrentWeekItem = vi.fn();
    render(
      <LeadFormItemSections
        unifiedView
        viewModel={unifiedViewModel(false)}
        actions={{ ...actions, addCurrentWeekItem, currentWeekAddSignal: 7 }}
        groupExpanded
        stagesForProduct={() => []}
      />,
    );

    expect(
      screen.getByText(
        "Current and next week items in one list, grouped by state. Use + Add to create records.",
      ),
    ).toBeVisible();
    expect(screen.getByTestId("unified-host")).toHaveAttribute(
      "data-add-signal",
      "7",
    );
    screen.getByRole("button", { name: "+ Add Item" }).click();
    expect(addCurrentWeekItem).toHaveBeenCalledOnce();
  });
});
