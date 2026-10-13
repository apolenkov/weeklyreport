import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
  QueryObserver,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@weeklyreport/api/infrastructure/trpc/trpc.router";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  LeadFormWriteError,
  type LeadFormWritePort,
} from "./lead-form-write-port";
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
    { path: ["leadForm", "statusOverview"] },
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

  describe.each([
    {
      command: "resolvePlan",
      write: (port: LeadFormWritePort) =>
        port.resolvePlan({
          reportSectionId: section.reportSectionId,
          version: 1,
          commandId: "66666666-6666-4666-8666-666666666666",
          source: {
            kind: "current",
            recordId: "77777777-7777-4777-8777-777777777777",
          },
          outcome: "done",
          stageNames: [],
        }),
    },
    {
      command: "restorePlan",
      write: (port: LeadFormWritePort) =>
        port.restorePlan({
          reportSectionId: section.reportSectionId,
          version: 1,
          commandId: "88888888-8888-4888-8888-888888888888",
          recordId: "99999999-9999-4999-8999-999999999999",
        }),
    },
    {
      command: "promotePlan",
      write: (port: LeadFormWritePort) =>
        port.promotePlan({
          reportSectionId: section.reportSectionId,
          version: 1,
          commandId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          recordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          target: "current",
        }),
    },
  ])("$command status projection", ({ command, write }) => {
    it.each(["success", "rejection"] as const)(
      "refreshes a warm active Overview only after success: %s",
      async (settlement) => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        });
        let savedSection = section;
        let overviewReads = 0;
        const client = createTRPCClient<AppRouter>({
          links: [
            () =>
              ({ op }) =>
                observable((observer) => {
                  if (op.path === "leadForm.statusOverview") {
                    expect(op.input).toEqual({ reportId: section.reportId });
                    overviewReads++;
                    observer.next({
                      result: {
                        data: {
                          current: {
                            reportId: section.reportId,
                            periodStart: new Date("2026-10-12T00:00:00Z"),
                            periodEnd: new Date("2026-10-18T00:00:00Z"),
                            section: savedSection,
                          },
                          predecessor: {
                            availability: "unavailable",
                            reason: "no_predecessor",
                          },
                        },
                      },
                    });
                  } else {
                    expect(op.path).toBe(`leadForm.${command}`);
                    expect(op.input).toMatchObject({
                      reportSectionId: section.reportSectionId,
                    });
                    if (settlement === "rejection") {
                      observer.error(
                        TRPCClientError.from(new Error("offline")),
                      );
                      return;
                    }
                    savedSection = { ...section, version: 2 };
                    observer.next({
                      result: {
                        data: {
                          section: savedSection,
                          stableId: "55555555-5555-4555-8555-555555555555",
                          replayed: false,
                        },
                      },
                    });
                  }
                  observer.complete();
                }),
          ],
        });
        const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient });
        const options = {
          ...trpc.leadForm.statusOverview.queryOptions({
            reportId: section.reportId,
          }),
          staleTime: 30_000,
        };
        await queryClient.query(options);
        const overview = new QueryObserver(queryClient, options);
        const unsubscribe = overview.subscribe(() => undefined);
        const leadFormKeys: QueryKey[] = [
          trpc.reports.getActive.queryKey(),
          trpc.leadForm.byPeriod.queryKey({ reportId: section.reportId }),
        ];
        const unrelatedKeys: QueryKey[] = [
          trpc.review.dashboard.queryKey(),
          trpc.leadForm.openWork.infiniteQueryKey({
            reportId: section.reportId,
            limit: 25,
          }),
        ];
        for (const key of [...leadFormKeys, ...unrelatedKeys])
          queryClient.setQueryData(key, "warm");
        function Wrapper({ children }: { readonly children: ReactNode }) {
          return (
            <QueryClientProvider client={queryClient}>
              <TRPCProxyContext.Provider value={trpc}>
                {children}
              </TRPCProxyContext.Provider>
            </QueryClientProvider>
          );
        }
        const { result, unmount } = renderHook(
          () => useLeadFormWritePort(section.reportSectionId),
          { wrapper: Wrapper },
        );
        try {
          expect(overview.getCurrentResult().isStale).toBe(false);
          expect(overviewReads).toBe(1);
          expect(
            overview.getCurrentResult().data?.current.section.version,
          ).toBe(1);
          await act(async () => {
            if (settlement === "success") {
              await expect(write(result.current)).resolves.toMatchObject({
                section: { version: 2 },
              });
            } else {
              await expect(write(result.current)).rejects.toEqual(
                new LeadFormWriteError("error", "offline"),
              );
            }
          });
          if (settlement === "success") {
            await waitFor(
              () =>
                expect(
                  queryClient.getQueryData(options.queryKey)?.current.section
                    .version,
                ).toBe(2),
              { timeout: 500 },
            );
            expect(
              overview.getCurrentResult().data?.current.section.version,
            ).toBe(2);
            expect(overviewReads).toBe(2);
          } else {
            expect(
              overview.getCurrentResult().data?.current.section.version,
            ).toBe(1);
            expect(overview.getCurrentResult().isStale).toBe(false);
            expect(overviewReads).toBe(1);
          }
          expect(
            leadFormKeys.map(
              (key) => queryClient.getQueryState(key)?.isInvalidated,
            ),
          ).toEqual([settlement === "success", settlement === "success"]);
          expect(
            unrelatedKeys.map(
              (key) => queryClient.getQueryState(key)?.isInvalidated,
            ),
          ).toEqual([false, false]);
        } finally {
          unmount();
          unsubscribe();
          queryClient.clear();
        }
      },
    );
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
