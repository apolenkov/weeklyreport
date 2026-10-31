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

describe("LeadForm Slides editor across a mode change (C4819)", () => {
  it("keeps the open risk editor and its typed text when Slides mode is left", async () => {
    const rendered = renderSlides();
    await openRiskEditor();

    rendered.rerender(<LeadForm mode="edit" />);

    expect(await screen.findByDisplayValue(TYPED)).toBeInTheDocument();
    expect(screen.queryByTestId("slides-deck")).not.toBeInTheDocument();
  });

  it("closes the held editor once the discard is confirmed", async () => {
    const rendered = renderSlides();
    await openRiskEditor();
    rendered.rerender(<LeadForm mode="edit" />);
    await screen.findByDisplayValue(TYPED);

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
  });

  it("unmounts the deck when Slides mode is left with no editor open", async () => {
    const rendered = renderSlides();
    expect(await screen.findByTestId("slides-deck")).toBeInTheDocument();

    rendered.rerender(<LeadForm mode="edit" />);

    await waitFor(() =>
      expect(screen.queryByTestId("slides-deck")).not.toBeInTheDocument(),
    );
  });
});
