import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { usePeriodMutations } from "./use-period-mutations";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => vi.unstubAllGlobals());

const reportId = "11111111-1111-4111-8111-111111111111";
type Mutations = ReturnType<typeof usePeriodMutations>;
const cases = [
  ["publish", (m: Mutations) => m.publishMut.mutateAsync({ reportId }), null],
  [
    "reopen",
    (m: Mutations) => m.reopenMut.mutateAsync({ reportId }),
    "onReopenSuccess",
  ],
  [
    "archive",
    (m: Mutations) => m.archiveMut.mutateAsync({ periodId: reportId }),
    null,
  ],
  [
    "restore",
    (m: Mutations) => m.unarchiveMut.mutateAsync({ periodId: reportId }),
    null,
  ],
  [
    "create",
    (m: Mutations) =>
      m.createMut.mutateAsync({
        periodStart: new Date("2026-09-07T00:00:00Z"),
      }),
    "onCreateSuccess",
  ],
  [
    "update",
    (m: Mutations) =>
      m.updateMut.mutateAsync({ reportId, weekLabel: "Renamed" }),
    "onEditSuccess",
  ],
  [
    "delete",
    (m: Mutations) => m.deleteMut.mutateAsync({ reportId }),
    "onDeleteSuccess",
  ],
] as const;

function setup(fails: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            fails
              ? [
                  {
                    error: {
                      json: {
                        message: "Period change failed",
                        code: -32_603,
                        data: {
                          code: "INTERNAL_SERVER_ERROR",
                          httpStatus: 500,
                        },
                      },
                    },
                  },
                ]
              : [{ result: { data: { json: {} } } }],
          ),
          {
            status: fails ? 500 : 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    ),
  );
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 30_000 },
    },
  });
  const proxy = makeTRPCProxy(client);
  const keys: QueryKey[] = [
    proxy.reports.compiledHistory.queryKey({ includeArchive: false }),
    proxy.admin.listPeriodsByState.queryKey({ bucket: "active" }),
    proxy.reports.getActive.queryKey(),
  ];
  const settings: QueryKey = proxy.admin.getSettings.queryKey();
  for (const key of [...keys, settings]) client.setQueryData(key, "before");
  const callbacks = {
    onCreateSuccess: vi.fn(),
    onEditSuccess: vi.fn(),
    onReopenSuccess: vi.fn(),
    onDeleteSuccess: vi.fn(),
  };
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const hook = renderHook(() => usePeriodMutations(callbacks), {
    wrapper: Wrapper,
  });
  return { ...hook, client, keys, settings, callbacks };
}

it.each(cases)(
  "%s success refreshes report projections and invokes only its completion callback",
  async (_name, mutate, callback) => {
    const h = setup(false);
    try {
      await act(async () => {
        await mutate(h.result.current);
      });
      expect(
        h.keys.map((key) => h.client.getQueryState(key)?.isInvalidated),
      ).toEqual([true, true, true]);
      expect(h.client.getQueryState(h.settings)?.isInvalidated).toBe(false);
      for (const [name, fn] of Object.entries(h.callbacks))
        expect(fn).toHaveBeenCalledTimes(name === callback ? 1 : 0);
    } finally {
      h.unmount();
      h.client.clear();
    }
  },
);

it.each(cases)(
  "%s failure preserves caches and completion callbacks",
  async (_name, mutate) => {
    const h = setup(true);
    try {
      await act(async () => {
        await expect(mutate(h.result.current)).rejects.toThrow(
          "Period change failed",
        );
      });
      expect(
        h.keys.map((key) => h.client.getQueryState(key)?.isInvalidated),
      ).toEqual([false, false, false]);
      for (const fn of Object.values(h.callbacks))
        expect(fn).not.toHaveBeenCalled();
    } finally {
      h.unmount();
      h.client.clear();
    }
  },
);
