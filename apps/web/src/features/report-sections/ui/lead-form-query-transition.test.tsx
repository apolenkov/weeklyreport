/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../lib/query-client";
import { SessionContext } from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { LeadForm } from "./lead-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../hooks/use-record-visibility", () => ({
  useRecordVisibility: () => ({
    visibility: "mine",
    hydrated: true,
    setVisibility: vi.fn(),
  }),
}));

vi.mock("../../../hooks/use-fullscreen", () => ({
  useFullscreen: () => ({ isFullscreen: false, toggle: vi.fn() }),
}));

vi.mock("./use-lead-form-foreign-content-purge", () => ({
  useLeadFormForeignContentPurge: () => undefined,
}));

vi.mock("./use-lead-form-redirects", () => ({
  useLeadFormRedirects: () => undefined,
}));

vi.mock("./use-lead-form-draft-orchestration", () => ({
  useLeadFormDraftOrchestration: ({
    serverSection,
  }: {
    serverSection?: unknown;
  }) => ({
    autosave: {},
    draftPayload: null,
    draftSection: serverSection ?? null,
    handleConflict: vi.fn(),
    isSubmitted: false,
    setDraftSection: vi.fn(),
    setIsSubmitted: vi.fn(),
    setVersionSafe: vi.fn(),
    versionRef: { current: 1 },
  }),
}));

vi.mock("./use-lead-form-write-actions", () => ({
  useLeadFormWriteActions: () => ({}),
}));

vi.mock("./use-lead-form-draft-merges", () => ({
  useLeadFormDraftMerges: () => ({}),
}));

vi.mock("./use-lead-form-chrome", () => ({
  useLeadFormChrome: () => ({
    selectedPeriodId: "report-a",
    showArchivePeriods: false,
    setShowArchivePeriods: vi.fn(),
  }),
}));

vi.mock("./lead-form-loaded-view-model", () => ({
  buildLeadFormLoadedViewModel: ({
    draftSection,
  }: {
    draftSection: { marker: string };
  }) => ({
    marker: draftSection.marker,
    products: [],
    ownRisks: [],
    currentWeekItems: [],
    nextWeekItems: [],
  }),
}));

vi.mock("./lead-form-header-actions", () => ({
  LeadFormHeaderActions: ({ viewModel }: { viewModel: { marker: string } }) => (
    <header>
      <span>{viewModel.marker}</span>
      <button type="button">Save</button>
      <button type="button">Submit</button>
      <button type="button">Revoke</button>
    </header>
  ),
}));

vi.mock("./lead-form-toolbar-controls", () => ({
  LeadFormToolbarControls: () => null,
}));
vi.mock("./lead-form-edit-sections", () => ({
  LeadFormEditSections: () => <div>Report A body</div>,
}));
vi.mock("./lead-form-past-period-banner", () => ({
  LeadFormPastPeriodBanner: () => null,
}));
vi.mock("./lead-form-dialogs", () => ({ LeadFormDialogs: () => null }));

const pending = new Promise<never>(() => undefined);

function makeProviders() {
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: { reportId: "report-a", reportSectionId: "section-a" },
    },
    { path: ["reports", "myHistory"], query: [] },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) =>
        (input as { reportId: string }).reportId === "report-a"
          ? {
              section: {
                reportSectionId: "section-a",
                marker: "Report A marker",
              },
              readOnly: false,
              canRequestReopen: false,
              publishedLineage: { itemStableIds: [], decisionStableIds: [] },
            }
          : pending,
    },
    { path: ["leadForm", "crossAuthors"], queryByInput: () => [] },
    { path: ["leadForm", "crossAuthorContent"], queryByInput: () => [] },
  ]);
  const client = makeQueryClient();

  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "lead-user",
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
  };
}

describe("LeadForm report-key transitions", () => {
  it("replaces report A body and mutation controls with the skeleton for pending report B", async () => {
    const rendered = render(<LeadForm reportId="report-a" />, {
      wrapper: makeProviders(),
    });
    expect(await screen.findByText("Report A body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    rendered.rerender(<LeadForm reportId="report-b" />);

    await waitFor(() => {
      expect(screen.queryByText("Report A body")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Report A marker")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /save|submit|revoke/i }),
    ).toBeNull();
  });
});
