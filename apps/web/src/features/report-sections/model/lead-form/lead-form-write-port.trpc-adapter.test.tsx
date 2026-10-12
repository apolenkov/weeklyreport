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
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
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
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

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
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "getActive"]],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["leadForm", "byPeriod"]],
    });
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
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

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
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

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
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "getActive"]],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["review", "dashboard"]],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "myHistory"]],
    });

    invalidate.mockClear();
    await act(() =>
      result.current.fillFrom({
        targetSectionId: section.reportSectionId,
        sourceSectionId: "44444444-4444-4444-8444-444444444444",
        version: 1,
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["leadForm", "byPeriod"]],
    });

    invalidate.mockClear();
    await act(() =>
      result.current.revoke({ reportSectionId: section.reportSectionId }),
    );
    expect(invalidate).toHaveBeenCalledTimes(6);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["weeklyReport", "get"]],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "myHistory"]],
    });

    invalidate.mockClear();
    await act(() =>
      result.current.requestReopen({
        reportSectionId: section.reportSectionId,
        reason: "Please reopen",
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "getActive"]],
    });
  });

  it("keeps outcome transport and lead-form invalidation in one seam", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    const outcome = {
      section: { ...section, version: 2 },
      stableId: "55555555-5555-4555-8555-555555555555",
      replayed: false,
    };
    expectDefined(
      captured["leadForm.resolvePlan"],
    ).mutationFn.mockResolvedValue(outcome);
    expectDefined(
      captured["leadForm.restorePlan"],
    ).mutationFn.mockResolvedValue({ ...outcome, replayed: true });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

    await act(() =>
      result.current.resolvePlan({
        reportSectionId: section.reportSectionId,
        version: 1,
        commandId: "66666666-6666-4666-8666-666666666666",
        source: {
          kind: "prior",
          reportId: section.reportId,
          recordId: "77777777-7777-4777-8777-777777777777",
        },
        outcome: "done",
        stageNames: [],
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["leadForm", "byPeriod"]],
    });

    invalidate.mockClear();
    await act(() =>
      result.current.restorePlan({
        reportSectionId: section.reportSectionId,
        version: 2,
        commandId: "88888888-8888-4888-8888-888888888888",
        recordId: "99999999-9999-4999-8999-999999999999",
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [["reports", "getActive"]],
    });
  });

  it("normalizes generic transport failures at the seam", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["leadForm.revoke"]).mutationFn.mockRejectedValue(
      new Error("offline"),
    );
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

    await expect(
      result.current.revoke({ reportSectionId: section.reportSectionId }),
    ).rejects.toEqual(new LeadFormWriteError("error", "offline"));
  });
});

it.each(["A-first", "B-first"] as const)(
  "tracks every actual section request through finally with %s settlement",
  async (order) => {
    const { Wrapper, captured } = buildHarness();
    const sectionB = "44444444-4444-4444-8444-444444444444";
    const flightA = Promise.withResolvers<unknown>();
    const flightB = Promise.withResolvers<unknown>();
    expectDefined(
      captured["leadForm.resolvePlan"],
    ).mutationFn.mockImplementation((input: unknown) => {
      const request = input as { reportSectionId: string };
      return request.reportSectionId === section.reportSectionId
        ? flightA.promise
        : flightB.promise;
    });
    const initialProps: { sectionId: string | null } = {
      sectionId: section.reportSectionId,
    };
    const { result, rerender, unmount } = renderHook(
      ({ sectionId }) => useLeadFormWritePort(sectionId),
      {
        wrapper: Wrapper,
        initialProps,
      },
    );
    const command = {
      version: 1,
      commandId: "55555555-5555-4555-8555-555555555555",
      source: {
        kind: "prior" as const,
        reportId: "66666666-6666-4666-8666-666666666666",
        recordId: "77777777-7777-4777-8777-777777777777",
      },
      outcome: "done" as const,
      stageNames: [],
    };
    let promiseA: Promise<unknown> | undefined;
    act(() => {
      promiseA = result.current.resolvePlan({
        ...command,
        reportSectionId: section.reportSectionId,
      });
    });
    await waitFor(() => expect(result.current.pending.resolvePlan).toBe(true));
    rerender({ sectionId: sectionB });
    expect(result.current.pending.resolvePlan).toBe(false);
    let promiseB: Promise<unknown> | undefined;
    act(() => {
      promiseB = result.current.resolvePlan({
        ...command,
        commandId: "88888888-8888-4888-8888-888888888888",
        reportSectionId: sectionB,
      });
    });
    await waitFor(() => expect(result.current.pending.resolvePlan).toBe(true));
    rerender({ sectionId: null });
    expect(result.current.pending.resolvePlan).toBe(true);
    rerender({ sectionId: section.reportSectionId });
    expect(result.current.pending.resolvePlan).toBe(true);
    const resultA = {
      section: { ...section, version: 2 },
      stableId: "99999999-9999-4999-8999-999999999999",
      replayed: false,
    };
    const resultB = {
      ...resultA,
      section: {
        ...section,
        reportSectionId: sectionB,
        reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        version: 2,
      },
    };
    await act(async () => {
      if (order === "A-first") {
        flightA.resolve(resultA);
        await promiseA;
      } else {
        flightB.resolve(resultB);
        await promiseB;
      }
    });
    expect(result.current.pending.resolvePlan).toBe(order === "B-first");
    rerender({ sectionId: sectionB });
    expect(result.current.pending.resolvePlan).toBe(order === "A-first");
    await act(async () => {
      if (order === "A-first") {
        flightB.resolve(resultB);
        await promiseB;
      } else {
        flightA.resolve(resultA);
        await promiseA;
      }
    });
    expect(result.current.pending.resolvePlan).toBe(false);
    rerender({ sectionId: section.reportSectionId });
    expect(result.current.pending.resolvePlan).toBe(false);
    unmount();
  },
);
