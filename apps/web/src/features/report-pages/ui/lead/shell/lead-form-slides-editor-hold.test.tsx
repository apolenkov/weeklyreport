// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadForm } from "./lead-form";
import { buildLeadLoadHarness } from "./lead-form-load-test-harness";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

// The real deck renders slide rows; this stand-in only exposes the row
// activation the inline editor listens to.
vi.mock("../../../../slides/ui/status-slide-deck", () => ({
  StatusSlideDeck: ({
    onRowActivate,
  }: {
    onRowActivate?: (ref: { kind: "risk"; stableId: string }) => void;
  }) => (
    <div data-testid="slides-deck">
      <button
        type="button"
        onClick={() =>
          onRowActivate?.({ kind: "risk", stableId: "risk-stable-1" })
        }
      >
        edit risk row
      </button>
    </div>
  ),
}));

const TYPED = "Typed but unsaved risk";
const PRODUCT_ID = "30000000-0000-4000-8000-000000000001";

function sectionWithRisk() {
  return makeLeadFormSectionFixture({
    reportId: "10000000-0000-4000-8000-000000000001",
    reportSectionId: "20000000-0000-4000-8000-000000000001",
    projects: [
      { projectId: PRODUCT_ID, projectName: "Alpha", trafficLight: null },
    ],
    risks: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        stableId: "risk-stable-1",
        projectId: PRODUCT_ID,
        activityId: null,
        risk: "Existing risk",
        impact: "Impact",
        mitigation: "Mitigation",
        severity: "at-risk",
        stageNames: [],
      },
    ],
  });
}

function renderSlides() {
  const section = sectionWithRisk();
  const { Wrapper } = buildLeadLoadHarness({
    activeQueryFn: () => section,
    historyQueryFn: () => ({
      items: [
        {
          sectionId: section.reportSectionId,
          reportId: section.reportId,
          periodStart: new Date("2026-08-31T00:00:00Z"),
          periodEnd: new Date("2026-09-06T00:00:00Z"),
          reportStatus: "open",
          sectionStatus: "draft",
          submittedAt: null,
          publishedAt: null,
        },
      ],
      nextCursor: null,
    }),
    byPeriodQueryFn: () => ({
      section,
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    }),
  });
  return render(<LeadForm mode="slides" />, { wrapper: Wrapper });
}

async function openRiskEditor(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "edit risk row" }));
  const field = await screen.findByDisplayValue("Existing risk");
  fireEvent.change(field, { target: { value: TYPED } });
}

// Back from Slides gives the Lead page mode "overview", not "edit".
describe("LeadForm Slides editor across a switch to Overview (C4819)", () => {
  it("keeps the open risk editor, its node and typed text while Overview renders", async () => {
    const rendered = renderSlides();
    await openRiskEditor();
    const field = screen.getByDisplayValue(TYPED);
    const dialog = screen.getByRole("dialog");

    rendered.rerender(<LeadForm mode="overview" />);

    expect(
      await screen.findByTestId("lead-status-overview-page"),
    ).toBeVisible();
    // Same DOM node: the editor was not remounted, so its state survived.
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(screen.getByDisplayValue(TYPED)).toBe(field);
    expect(dialog).toBeVisible();
  });

  it("ends the hold when the held editor is cancelled", async () => {
    const rendered = renderSlides();
    await openRiskEditor();
    rendered.rerender(<LeadForm mode="overview" />);
    await screen.findByTestId("lead-status-overview-page");

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByDisplayValue(TYPED)).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("slides-deck")).not.toBeInTheDocument();
    expect(screen.getByTestId("lead-status-overview-page")).toBeVisible();
  });

  it("unmounts the deck when Overview is shown with no editor open", async () => {
    const rendered = renderSlides();
    expect(await screen.findByTestId("slides-deck")).toBeInTheDocument();

    rendered.rerender(<LeadForm mode="overview" />);

    await screen.findByTestId("lead-status-overview-page");
    expect(screen.queryByTestId("slides-deck")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lead-report-form")).not.toBeInTheDocument();
  });

  it("shows only Overview when Edit mode already dropped the open editor", async () => {
    const rendered = renderSlides();
    await openRiskEditor();

    rendered.rerender(<LeadForm mode="edit" />);
    await waitFor(() =>
      expect(screen.queryByTestId("slides-deck")).not.toBeInTheDocument(),
    );
    rendered.rerender(<LeadForm mode="overview" />);

    await screen.findByTestId("lead-status-overview-page");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lead-report-form")).not.toBeInTheDocument();
  });
});
