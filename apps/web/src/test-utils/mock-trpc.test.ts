import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "./mock-trpc";

// Structural Record view of the dynamic stub (not the full TRPCProxy type).
function leaf(proxy: unknown, ...path: string[]): Record<string, unknown> {
  return path.reduce<Record<string, unknown>>(
    (node, segment) => node[segment] as Record<string, unknown>,
    proxy as Record<string, unknown>,
  );
}

function makeWrapper(proxy: unknown) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        TRPCProxyContext.Provider,
        { value: proxy as never },
        children,
      ),
    );
  }
  return { qc, Wrapper };
}

describe("createMockTRPC — pathFilter shape (contract pin)", () => {
  it("pathFilter() returns { queryKey: [[...splitPath]] } for a single-segment path", () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "getOrganization"], query: {} },
    ]);
    const pathFilter = leaf(proxy, "admin", "getOrganization")
      .pathFilter as () => unknown;
    const filter = pathFilter();
    expect(filter).toEqual({ queryKey: [["admin", "getOrganization"]] });
    expect(filter).not.toHaveProperty("tag");
  });

  it("pathFilter() queryKey equals [[...splitPath]] for a 3-segment path", () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "jobs", "listFailed"], query: [] },
    ]);
    const pathFilter = leaf(proxy, "admin", "jobs", "listFailed")
      .pathFilter as () => { queryKey: unknown };
    const filter = pathFilter();
    expect(filter.queryKey).toEqual([["admin", "jobs", "listFailed"]]);
  });
});

describe("createMockTRPC — invalidation is non-vacuous", () => {
  it("invalidateQueries via pathFilter() marks only the matching query stale", async () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "getOrganization"], query: { id: "org-1" } },
      { path: ["admin", "getSettings"], query: { timezone: "UTC" } },
    ]);
    const { qc } = makeWrapper(proxy);

    interface QueryOpts {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    }
    const orgQueryOptions = leaf(proxy, "admin", "getOrganization")
      .queryOptions as () => QueryOpts;
    const orgOpts = orgQueryOptions();
    const settingsQueryOptions = leaf(proxy, "admin", "getSettings")
      .queryOptions as () => QueryOpts;
    const settingsOpts = settingsQueryOptions();

    await qc.query(orgOpts);
    await qc.query(settingsOpts);

    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);

    const pathFilter = leaf(proxy, "admin", "getOrganization")
      .pathFilter as () => Parameters<typeof qc.invalidateQueries>[0];
    await qc.invalidateQueries(pathFilter());

    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);
  });
});

describe("createMockTRPC — pending descriptor", () => {
  it('a "pending" descriptor does not settle after the initial query tick', async () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "jobs", "listFailed"], query: "pending" },
    ]);
    const queryOptions = leaf(proxy, "admin", "jobs", "listFailed")
      .queryOptions as () => { queryFn: () => Promise<unknown> };

    const outcome = await Promise.race([
      queryOptions()
        .queryFn()
        .then(() => "resolved"),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("still-pending"), 20);
      }),
    ]);

    expect(outcome).toBe("still-pending");
  });
});

describe("createMockTRPC — descriptor validation", () => {
  it("rejects descriptors that define both query forms", () => {
    expect(() =>
      createMockTRPC([
        {
          path: ["reports", "get"],
          query: {},
          queryByInput: () => ({}),
        },
      ]),
    ).toThrow(
      'Procedure "reports.get" cannot define both query and queryByInput.',
    );
  });
});

describe("createMockTRPC — mutation capture", () => {
  it("records mutationFn input in calls array", async () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["admin", "updateOrganization"], mutation: true },
    ]);

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const mutationOptions = leaf(proxy, "admin", "updateOrganization")
      .mutationOptions as (opts: Record<string, unknown>) => {
      mutationFn: (vars: unknown) => Promise<unknown>;
    };
    const opts = mutationOptions({ onSuccess, onError });

    await opts.mutationFn({ shortName: "ACME" });

    const entry = captured["admin.updateOrganization"];
    expect(entry).toBeDefined();
    expect(entry?.calls).toHaveLength(1);
    expect(entry?.calls[0]).toEqual({ shortName: "ACME" });
  });

  it("captures caller-passed onSuccess and onError in lastOptions", () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["reports", "saveDraft"], mutation: true },
    ]);

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const mutationOptions = leaf(proxy, "reports", "saveDraft")
      .mutationOptions as (opts: Record<string, unknown>) => unknown;
    mutationOptions({ onSuccess, onError });

    const entry = captured["reports.saveDraft"];
    expect(entry).toBeDefined();
    expect(entry?.lastOptions.onSuccess).toBe(onSuccess);
    expect(entry?.lastOptions.onError).toBe(onError);
  });
});
