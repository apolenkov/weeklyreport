// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { leadFormGenerationOf } from "../../../../report-sections/model/lead-form/lead-form-generation";
import { InMemoryLeadFormWriteAdapter } from "../../../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { useLeadFormDraft } from "../../../../report-sections/model/lead-form/use-lead-form-draft";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";
import { useLeadFormReports } from "./use-lead-form-queries";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeWrapper(byPeriodQuery: () => unknown) {
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
      },
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: byPeriodQuery,
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "crossAuthors"], queryByInput: () => [] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return Wrapper;
}

function renderConflictReload(byPeriodQuery: () => unknown) {
  const Wrapper = makeWrapper(byPeriodQuery);
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: () => Promise.resolve(makeByPeriodResult().section),
    submit: () => Promise.resolve(makeByPeriodResult().section),
  });

  return renderHook(
    () => {
      const reports = useLeadFormReports({
        pinnedReportId: undefined,
        sectionFetchEnabled: true,
      });
      const section = reports.view.byPeriodData?.section;
      const draft = useLeadFormDraft({
        writePort,
        generation: section ? leadFormGenerationOf(section) : null,
        serverSection: section,
        sectionIdForActions: reports.view.sectionIdForActions,
        serverReadOnly: reports.view.byPeriodData?.readOnly ?? true,
        refetchSection: reports.view.refetchSection,
        crossAuthors: reports.view.crossAuthors,
        isEveryone: false,
      });
      return { reports, draft };
    },
    { wrapper: Wrapper },
  );
}

function makeByPeriodResult() {
  return {
    section: makeLeadFormSectionFixture({
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: USER_ID,
    }),
    readOnly: false,
    canRequestReopen: false,
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
  };
}

describe("useLeadFormReports refetchSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("announces failure and retains the active draft when refetch fails", async () => {
    const refetchError = new Error("section refetch failed");
    const byPeriodQuery = vi
      .fn()
      .mockReturnValueOnce(makeByPeriodResult())
      .mockRejectedValueOnce(refetchError);
    const { result } = renderConflictReload(byPeriodQuery);

    await waitFor(() => expect(result.current.draft.draft).not.toBeNull());
    act(() => {
      result.current.draft.apply({
        kind: "risks",
        risks: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            productId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            productName: "Test Product",
            stageNames: [],
            severity: "at-risk",
            text: "Local conflict draft",
            impact: "Delivery may slip",
            mitigation: "Re-plan the work",
          },
        ],
      });
      result.current.draft.reloadAfterConflict();
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This section was changed elsewhere. Reload failed — refresh the page and re-apply your changes.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Reloaded the latest version"),
    );
    expect(result.current.draft.draft?.risks).toEqual([
      expect.objectContaining({ risk: "Local conflict draft" }),
    ]);
    expect(byPeriodQuery).toHaveBeenCalledTimes(2);
  });

  it("announces a successful active section reload", async () => {
    const byPeriodQuery = vi.fn(() => makeByPeriodResult());
    const { result } = renderConflictReload(byPeriodQuery);

    await waitFor(() => expect(result.current.draft.draft).not.toBeNull());
    act(() => result.current.draft.reloadAfterConflict());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
      ),
    );
    expect(byPeriodQuery).toHaveBeenCalledTimes(2);
  });
});
