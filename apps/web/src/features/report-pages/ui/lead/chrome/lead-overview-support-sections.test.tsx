import type { ReportSectionReadModel } from "@customreport/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { describe, expect, it } from "vitest";

import { buildLeadFormLoadedViewModel } from "../../../../report-sections";
import { makeDraftMergeSection } from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import {
  type LeadOverviewSupportActions,
  LeadOverviewSupportSections,
} from "./lead-overview-support-sections";

function withReviewerFeedback(
  section: ReportSectionReadModel,
): ReportSectionReadModel {
  const firstItem = section.items[0];
  if (!firstItem) throw new Error("Expected the fixture to contain an item");
  return {
    ...section,
    items: [
      {
        ...firstItem,
        comments: [
          {
            id: "10101010-1010-4010-8010-101010101010",
            reviewerId: "20202020-2020-4020-8020-202020202020",
            reviewerName: "Department Head",
            text: "Clarify the delivery outcome.",
            createdAt: new Date("2026-09-05T08:00:00Z"),
          },
        ],
      },
      ...section.items.slice(1),
    ],
  };
}

function buildViewModel(section: ReportSectionReadModel) {
  return buildLeadFormLoadedViewModel({
    active: section,
    draftSection: section,
    serverReadOnly: false,
    canRequestReopen: false,
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    history: [],
    crossAuthors: [],
    foreignContent: undefined,
    isEveryone: false,
    visibilityHydrated: true,
    isForeignSlidesDeck: false,
    isSubmitted: false,
    selectedPeriodId: null,
    showArchivePeriods: false,
  });
}

interface HarnessProps {
  readonly pendingInput?: boolean;
  readonly groupExpanded?: boolean;
  readonly initialSection?: ReportSectionReadModel;
}

function Harness({
  pendingInput = false,
  groupExpanded = true,
  initialSection,
}: HarnessProps) {
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const section = useMemo(
    () => initialSection ?? withReviewerFeedback(makeDraftMergeSection()),
    [initialSection],
  );
  const viewModel = useMemo(() => buildViewModel(section), [section]);
  const actions: LeadOverviewSupportActions = {
    onProductsChange: () => undefined,
    onRisksChange: () => undefined,
    risksAddSignal,
    riskPrefill: null,
    addRisk: () => setRisksAddSignal((value) => value + 1),
    onDecisionsChange: () => undefined,
    addDecision: () => undefined,
    decisionsAddSignal: 0,
  };

  return (
    <LeadOverviewSupportSections
      viewModel={viewModel}
      actions={actions}
      draftSection={section}
      serverSection={section}
      groupExpanded={groupExpanded}
      recordVisibility="mine"
      visibilityHydrated
      crossAuthorEntries={[]}
      pendingInput={pendingInput}
    />
  );
}

describe("LeadOverviewSupportSections", () => {
  it("opens risk entry for an activity-only Overview", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialSection={{
          ...makeDraftMergeSection(),
          projects: [],
          items: [],
          risks: [],
          decisions: [],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "+ Add Risk" }));
    const dialog = await screen.findByRole("dialog", {
      name: /^Add Risk/,
    });
    expect(
      within(dialog).getByRole("option", { name: "Ops rotation" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("option", { name: "Test Product" }),
    ).not.toBeInTheDocument();
  });

  it("renders support parity without duplicating Current or Next item sections", () => {
    render(<Harness />);

    expect(screen.queryByText("Product Status")).toBeNull();
    expect(screen.queryByText("Project Activities")).toBeNull();
    expect(screen.getByText("Risks & Blockers")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(screen.getByTestId("lead-review-feedback")).toHaveTextContent(
      "Clarify the delivery outcome.",
    );
    expect(screen.queryByTestId("lead-section-current-week")).toBeNull();
    expect(screen.queryByTestId("lead-section-next-week")).toBeNull();
    expect(screen.queryByTestId("lead-section-unified-items")).toBeNull();
  });

  it("disables support writes while another Overview input is pending", () => {
    render(<Harness pendingInput />);
    expect(
      screen.queryByRole("group", { name: "Status for Ops rotation" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Add Risk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Add Decision" })).toBeNull();
  });

  it("opens the collapsed risks section when its add signal advances", async () => {
    const user = userEvent.setup();
    render(<Harness groupExpanded={false} />);

    expect(
      screen.getByRole("button", { name: "Expand Risks & Blockers" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "+ Add Risk" }));

    await screen.findByRole("dialog", { name: /^Add Risk/ });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Collapse Risks & Blockers" }),
      ).toHaveAttribute("aria-expanded", "true"),
    );

    await user.click(
      screen.getByRole("button", { name: "Collapse Risks & Blockers" }),
    );
    expect(
      screen.getByRole("button", { name: "Expand Risks & Blockers" }),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "+ Add Risk" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Collapse Risks & Blockers" }),
      ).toHaveAttribute("aria-expanded", "true"),
    );
  });
});
