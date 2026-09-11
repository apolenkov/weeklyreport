// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type {
  ActivityLiveResponse,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import {
  makeReportSectionFixture,
  makeWeeklyReportFixture,
} from "../../../test-utils/report-section-fixtures";
import type { SectionSlideModel } from "../model/section-slide-contracts";
import { HeadSlidesClient } from "./head-slides-client";

vi.mock("../../../shared/hooks/query/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));
vi.mock("./status-slide-deck", () => ({
  StatusSlideDeck: ({ slides }: { slides: readonly SectionSlideModel[] }) => (
    <div data-testid="deck" data-count={slides.length}>
      {slides.map((slide) => slide.ownerName).join(", ")}
    </div>
  ),
}));

const SELECTED_REPORT = "10000000-0000-4000-8000-000000000001";
const OTHER_REPORT = "10000000-0000-4000-8000-000000000002";
const LEAD = "10000000-0000-4000-8000-000000000003";

function activity(reportId: string): ActivityLiveResponse {
  return {
    reportId,
    periodStart: new Date("2026-08-31"),
    periodEnd: new Date("2026-09-06"),
    periodStatus: "open",
    rows: [
      {
        reportId,
        reportSectionId: null,
        leadId: LEAD,
        leadName: "Current Lead",
        email: null,
        status: "draft",
        itemCount: 0,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
        lastEditAt: null,
        submittedAt: null,
      },
    ],
  };
}

function renderDeck(
  report: WeeklyReportReadModel | null,
  liveReportId = SELECTED_REPORT,
  enableActivity = true,
) {
  const live = vi.fn(() => activity(liveReportId));
  const { proxy } = createMockTRPC([
    {
      path: ["weeklyReport", "get"],
      query: report
        ? { status: "active", ...report }
        : { status: "no-period", report: null },
    },
    { path: ["activity", "live"], query: live },
  ]);
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <TRPCProxyContext.Provider value={proxy}>
        <HeadSlidesClient
          reportId={SELECTED_REPORT}
          enableActivity={enableActivity}
        />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
  return live;
}

const emptyReport = () =>
  makeWeeklyReportFixture({
    reportId: SELECTED_REPORT,
    periodStatus: "open",
    archived: false,
    leadSections: [],
  });

describe("head slide period identity with real query enablement", () => {
  it("keeps an empty selected period empty when live activity belongs elsewhere", async () => {
    const live = renderDeck(emptyReport(), OTHER_REPORT);
    const deck = await screen.findByTestId("deck");
    expect(live).toHaveBeenCalledOnce();
    expect(deck).toHaveAttribute("data-count", "0");
    expect(deck).not.toHaveTextContent("Current");
  });

  it.each(["open", "reopened"] as const)(
    "retains matching activity for an empty %s report",
    async (periodStatus) => {
      const live = renderDeck(
        makeWeeklyReportFixture({ ...emptyReport(), periodStatus }),
      );
      const deck = await screen.findByTestId("deck");
      expect(live).toHaveBeenCalledOnce();
      expect(deck).toHaveAttribute("data-count", "1");
      expect(deck).toHaveTextContent("Current");
    },
  );

  it.each([
    {
      name: "published",
      report: () =>
        makeWeeklyReportFixture({
          ...emptyReport(),
          periodStatus: "published",
        }),
      enableActivity: true,
    },
    {
      name: "archived",
      report: () =>
        makeWeeklyReportFixture({ ...emptyReport(), archived: true }),
      enableActivity: true,
    },
    {
      name: "populated",
      report: () =>
        makeWeeklyReportFixture({
          ...emptyReport(),
          leadSections: [
            makeReportSectionFixture({ reportId: SELECTED_REPORT }),
          ],
        }),
      enableActivity: true,
    },
    { name: "host-disabled", report: emptyReport, enableActivity: false },
  ])(
    "does not request unused activity for a $name deck",
    async ({ report, enableActivity }) => {
      const live = renderDeck(report(), OTHER_REPORT, enableActivity);
      await screen.findByTestId("deck");
      expect(live).not.toHaveBeenCalled();
    },
  );

  it("does not request activity when no period exists", async () => {
    const live = renderDeck(null);
    await screen.findByText("No active deck");
    expect(live).not.toHaveBeenCalled();
  });
});
