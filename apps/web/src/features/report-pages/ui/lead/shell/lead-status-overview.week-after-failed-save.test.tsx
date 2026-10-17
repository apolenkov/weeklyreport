import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000002";
const STAGE_ID = "a0000000-0000-4000-8000-000000000003";

function renderOverviewWithFailingSave() {
  const section = makeReportSectionFixture({
    reportId: REPORT_ID,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 0 },
        ],
      },
    ],
    items: [
      {
        id: "a0000000-0000-4000-8000-000000000010",
        stableId: "a0000000-0000-4000-8000-000000000011",
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Current work",
        tag: "delivery",
        workflowStatus: "in_progress",
        pausedReason: null,
        carriedOver: false,
        nextStepText: null,
        stageNames: ["Development"],
      },
    ],
  });
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "getActive"], query: () => section },
    {
      path: ["leadForm", "statusOverview"],
      queryByInput: () => ({
        current: {
          reportId: REPORT_ID,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section,
        },
        predecessor: {
          availability: "unavailable" as const,
          reason: "no_predecessor" as const,
        },
      }),
    },
    {
      path: ["leadForm", "openWork"],
      query: { occurrences: [], nextCursor: null },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: () => ({
        section,
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["ai", "availability"], query: { availability: "unavailable" } },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
  ]);
  captured["reports.saveDraft"]?.mutationFn.mockRejectedValue(
    new Error("network unavailable"),
  );
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TRPCProxyContext.Provider value={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: section.authorId,
              name: "Test Lead",
              email: "lead@example.test",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <LeadReportAssistantStore>
            <LeadForm reportId={REPORT_ID} mode="overview" />
          </LeadReportAssistantStore>
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
}

// TASK-503.21 / C4929: changeWeek ignores every call while a submission exists,
// including after a failed save, yet the failed-save dialog keeps the week
// radios enabled. A clickable control must not be a silent no-op.
describe("Overview editor — Active week after a failed save", () => {
  it("never leaves an enabled Active week radio that ignores a click", async () => {
    const user = userEvent.setup();
    renderOverviewWithFailingSave();
    await user.click(
      await screen.findByRole("button", { name: "Edit item: Current work" }),
    );
    const description = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(description);
    await user.type(description, "Keep my failed update");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    await screen.findByText(
      "Save failed. Your update is still here; try saving again.",
      undefined,
      { timeout: 5000 },
    );

    const next = screen.getByRole<HTMLInputElement>("radio", {
      name: "Next week",
    });
    await user.click(next);

    // Either the choice applies, or the control is honestly disabled.
    expect(next.matches(":disabled") || next.checked).toBe(true);
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Keep my failed update",
    );
  });
});
