// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { makeQueryClient } from "../../../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { KanbanItem } from "../../../../report-sections";
import { LeadForm } from "./lead-form";

const { captureQuickAddSave } = vi.hoisted(() => ({
  captureQuickAddSave: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../../report-sections/client", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../report-sections/client")
  >("../../../../report-sections/client");
  return {
    ...actual,
    useLeadFormWritePort: () => ({
      pending: {
        saveDraft: false,
        submit: false,
        resolvePlan: false,
        restorePlan: false,
        fillFrom: false,
        revoke: false,
        reopen: false,
      },
      saveDraft: vi.fn(),
      submit: vi.fn(),
      resolvePlan: vi.fn(),
      restorePlan: vi.fn(),
      fillFrom: vi.fn(),
      revoke: vi.fn(),
      requestReopen: vi.fn(),
    }),
    useRecordVisibility: () => ({
      visibility: "mine",
      hydrated: true,
      setVisibility: vi.fn(),
    }),
  };
});
vi.mock("../../../../report-sections", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../report-sections")
  >("../../../../report-sections");
  return {
    ...actual,
    buildLeadFormLoadedViewModel: ({
      draftSection,
    }: {
      draftSection: ReportSectionReadModel;
    }) => ({
      products: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Test Product",
          overallStatus: "on-track",
          stages: [],
        },
      ],
      currentWeekItems: [],
      nextWeekItems: [],
      reportId: draftSection.reportId,
    }),
  };
});
vi.mock("../../../../../shared/hooks/browser/use-fullscreen", () => ({
  useFullscreen: () => ({ isFullscreen: false, toggle: vi.fn() }),
}));
vi.mock("./use-lead-form-foreign-content-purge", () => ({
  useLeadFormForeignContentPurge: () => undefined,
}));
vi.mock("./use-lead-form-redirects", () => ({
  useLeadFormRedirects: () => undefined,
}));
vi.mock("../chrome/use-lead-form-write-actions", () => ({
  useLeadFormWriteActions: () => ({ handleSubmit: vi.fn() }),
}));
vi.mock("../chrome/use-lead-form-chrome", () => ({
  useLeadFormChrome: ({ pinnedReportId }: { pinnedReportId: string }) => ({
    selectedPeriodId: pinnedReportId,
    showArchivePeriods: false,
    setShowArchivePeriods: vi.fn(),
  }),
}));
vi.mock("./lead-form-loaded", () => ({
  LeadFormLoaded: ({
    draftSection,
    draftActions,
  }: {
    draftSection: ReportSectionReadModel;
    draftActions: {
      onQuickAdd: (kind: "current-item") => void;
      quickAddItem: unknown;
      onQuickAddSave: (item: KanbanItem) => void;
    };
  }) => (
    <section>
      <output>{`${draftSection.reportId}:${draftSection.items.length}`}</output>
      <button
        type="button"
        onClick={() => draftActions.onQuickAdd("current-item")}
      >
        Open quick add
      </button>
      {draftActions.quickAddItem ? <span>Quick add open</span> : null}
      <button
        type="button"
        onClick={() => {
          captureQuickAddSave(draftActions.onQuickAddSave);
        }}
      >
        Capture save
      </button>
    </section>
  ),
}));

const AUTHOR = "11111111-1111-4111-8111-111111111111";

function section(reportId: string, reportSectionId: string) {
  return makeReportSectionFixture({
    reportSectionId,
    reportId,
    authorId: AUTHOR,
    authorName: "Test Lead",
    authorRole: "lead" as const,
  });
}

function makeProviders() {
  const reportA = section("report-a", "section-a");
  const reportB = section("report-b", "section-b");
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "getActive"], query: reportA },
    { path: ["reports", "myHistory"], query: { items: [] } },
    { path: ["reports", "saveDraft"], mutation: true },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) => ({
        section:
          (input as { reportId: string }).reportId === "report-a"
            ? reportA
            : reportB,
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    { path: ["leadForm", "crossAuthors"], queryByInput: () => [] },
    { path: ["leadForm", "crossAuthorContent"], queryByInput: () => [] },
  ]);
  const client = makeQueryClient();
  function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: AUTHOR,
              name: "Test Lead",
              email: "lead@example.com",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }
  return { Providers, captured };
}

describe("LeadForm generation navigation", () => {
  beforeEach(() => captureQuickAddSave.mockReset());

  it("cannot merge report A quick-add into either report after report B loads", async () => {
    const { Providers, captured } = makeProviders();
    const rendered = render(<LeadForm reportId="report-a" />, {
      wrapper: Providers,
    });
    expect(await screen.findByText("report-a:0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open quick add" }));
    expect(await screen.findByText("Quick add open")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Capture save" }));
    const staleSave = captureQuickAddSave.mock.calls[0]?.[0] as
      ((item: KanbanItem) => void) | undefined;
    expect(staleSave).toBeDefined();

    rendered.rerender(<LeadForm reportId="report-b" />);
    expect(await screen.findByText("report-b:0")).toBeInTheDocument();
    act(() =>
      staleSave?.({
        id: "44444444-4444-4444-8444-444444444444",
        parent: {
          kind: "product",
          id: "33333333-3333-4333-8333-333333333333",
        },
        productId: "33333333-3333-4333-8333-333333333333",
        productName: "Test Product",
        activityId: null,
        status: "planned",
        text: "Captured under report A",
        author: "Test Lead",
        priorityRank: null,
        stageNames: [],
      }),
    );
    expect(screen.getByText("report-b:0")).toBeInTheDocument();
    expect(captured["reports.saveDraft"]?.calls).toEqual([]);

    rendered.rerender(<LeadForm reportId="report-a" />);
    await waitFor(() =>
      expect(screen.getByText("report-a:0")).toBeInTheDocument(),
    );
  });
});
