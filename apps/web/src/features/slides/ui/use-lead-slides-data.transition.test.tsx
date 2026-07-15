/**
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../lib/query-client";
import { SessionContext } from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { useLeadSlidesData } from "./use-lead-slides-data";

vi.mock("next/navigation", () => ({
  usePathname: () => "/lead/report/report-a",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../lib/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

vi.mock("../model/lead-slide-periods", () => ({
  buildLeadSlidePeriodOptions: () => [],
  resolveLeadSlideReportId: ({
    requestedReportId,
  }: {
    requestedReportId: string | null;
  }) => requestedReportId ?? "",
}));

vi.mock("../model/lead-slides-deck-model", () => ({
  buildLeadDeckModel: (section: unknown) => section,
}));

vi.mock("../model/section-slide-pagination", () => ({
  paginateSectionSlides: (model: unknown) => [model],
}));

vi.mock("../../report-sections", () => ({
  mapLeadFormData: () => ({ readOnly: false }),
}));

const pending = new Promise<never>(() => undefined);

function makeProviders() {
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"], query: { reportId: "report-a" } },
    { path: ["reports", "myHistory"], query: [] },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) =>
        (input as { reportId: string }).reportId === "report-a"
          ? { section: { id: "section-a", marker: "Report A slide" } }
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

describe("useLeadSlidesData report-key transitions", () => {
  it("drops report A slides and edit state while report B is pending", async () => {
    const rendered = renderHook(
      ({ reportId }) =>
        useLeadSlidesData({
          initialReportId: reportId,
          visibilityMode: "mine",
          visibilityHydrated: true,
        }),
      {
        initialProps: { reportId: "report-a" },
        wrapper: makeProviders(),
      },
    );
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(JSON.stringify(rendered.result.current.slides)).toContain(
      "Report A slide",
    );
    expect(rendered.result.current.canInlineEdit).toBe(true);

    rendered.rerender({ reportId: "report-b" });

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(true));
    expect(rendered.result.current.slides).toEqual([]);
    expect(rendered.result.current.section).toBeNull();
    expect(rendered.result.current.formData).toBeNull();
    expect(rendered.result.current.canInlineEdit).toBe(false);
  });
});
