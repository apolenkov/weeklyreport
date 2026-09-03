import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { LeadFormWriteError } from "./lead-form-write-port";
import { useLeadFormWritePort } from "./lead-form-write-port.trpc-adapter";

const section = makeReportSectionFixture({
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Test Lead",
});

function buildHarness() {
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["reports", "getActive"] },
    { path: ["reports", "myHistory"] },
    { path: ["leadForm", "byPeriod"] },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  return { Wrapper, captured, queryClient };
}

describe("useLeadFormWritePort", () => {
  it("keeps transport pending state and success invalidation in the adapter", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    let resolveSave!: () => void;
    expectDefined(captured["reports.saveDraft"]).mutationFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => resolve(section);
        }),
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(useLeadFormWritePort, { wrapper: Wrapper });

    let savePromise!: Promise<unknown>;
    act(() => {
      savePromise = result.current.saveDraft({
        reportSectionId: section.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [],
        decisions: [],
      });
    });
    await waitFor(() => expect(result.current.pending.saveDraft).toBe(true));
    await act(async () => {
      resolveSave();
      await savePromise;
    });
    await waitFor(() => expect(result.current.pending.saveDraft).toBe(false));
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("normalizes transport conflicts at the seam", async () => {
    const { Wrapper, captured } = buildHarness();
    const conflict = new TRPCClientError<never>("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    expectDefined(captured["reports.submit"]).mutationFn.mockRejectedValue(
      conflict,
    );
    const { result } = renderHook(useLeadFormWritePort, { wrapper: Wrapper });

    await expect(
      result.current.submit({
        reportSectionId: section.reportSectionId,
        version: 1,
        confirmed: true,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [],
        decisions: [],
      }),
    ).rejects.toEqual(new LeadFormWriteError("conflict", "stale"));
  });

  it("owns success invalidation for every lifecycle command", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    expectDefined(captured["reports.submit"]).mutationFn.mockResolvedValue(
      section,
    );
    expectDefined(captured["leadForm.fillFrom"]).mutationFn.mockResolvedValue({
      success: true,
      copiedItems: 2,
    });
    expectDefined(captured["leadForm.revoke"]).mutationFn.mockResolvedValue({
      success: true,
    });
    expectDefined(
      captured["leadForm.requestReopen"],
    ).mutationFn.mockResolvedValue({ success: true });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(useLeadFormWritePort, { wrapper: Wrapper });

    await act(() =>
      result.current.submit({
        reportSectionId: section.reportSectionId,
        version: 1,
        confirmed: true,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [],
        decisions: [],
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(6);

    invalidate.mockClear();
    await act(() =>
      result.current.fillFrom({
        targetSectionId: section.reportSectionId,
        sourceSectionId: "44444444-4444-4444-8444-444444444444",
        version: 1,
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);

    invalidate.mockClear();
    await act(() =>
      result.current.revoke({ reportSectionId: section.reportSectionId }),
    );
    expect(invalidate).toHaveBeenCalledTimes(6);

    invalidate.mockClear();
    await act(() =>
      result.current.requestReopen({
        reportSectionId: section.reportSectionId,
        reason: "Please reopen",
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("normalizes generic transport failures at the seam", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["leadForm.revoke"]).mutationFn.mockRejectedValue(
      new Error("offline"),
    );
    const { result } = renderHook(useLeadFormWritePort, { wrapper: Wrapper });

    await expect(
      result.current.revoke({ reportSectionId: section.reportSectionId }),
    ).rejects.toEqual(new LeadFormWriteError("error", "offline"));
  });
});
