/**
 * Contract tests for createMockTRPC.
 *
 * Pins:
 *  (a) pathFilter() returns { queryKey: [splitPath] } — fails under the old
 *      { tag } shape.
 *  (b) invalidateQueries(pathFilter()) marks ONLY the matching query stale
 *      (negative assertion on an unrelated seeded query).
 *  (c) A "pending" descriptor's query promise remains unsettled.
 *  (d) Mutation capture records mutationFn input and caller-passed callbacks.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../lib/trpc-context";
import { createMockTRPC } from "./mock-trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walks the mock proxy by dotted path and returns the leaf as a plain
 * record. The mock proxy's real type (`TRPCProxy`) is the full production
 * router shape; these tests exercise the dynamically-built stub structure
 * itself (pathFilter/queryOptions/mutationOptions), so a structural
 * `Record<string, unknown>` view — not `any` — is what the assertions need.
 */
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

// ---------------------------------------------------------------------------
// (a) pathFilter shape — must carry queryKey, not tag
// ---------------------------------------------------------------------------

describe("createMockTRPC — pathFilter shape (contract pin)", () => {
  it("pathFilter() returns { queryKey: [[...splitPath]] } for a single-segment path", () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "getOrganization"], query: {} },
    ]);
    const pathFilter = leaf(proxy, "admin", "getOrganization")
      .pathFilter as () => unknown;
    const filter = pathFilter();
    expect(filter).toEqual({ queryKey: [["admin", "getOrganization"]] });
    // Old vacuous shape must NOT be present.
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

// ---------------------------------------------------------------------------
// (b) invalidateQueries marks ONLY the matching query stale
// ---------------------------------------------------------------------------

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

    await qc.fetchQuery(orgOpts);
    await qc.fetchQuery(settingsOpts);

    // Both queries are now fresh.
    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);

    // Invalidate only getOrganization via its pathFilter.
    const pathFilter = leaf(proxy, "admin", "getOrganization")
      .pathFilter as () => Parameters<typeof qc.invalidateQueries>[0];
    await qc.invalidateQueries(pathFilter());

    // getOrganization is stale; getSettings is NOT.
    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (c) "pending" descriptor remains unsettled
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// (d) Mutation capture
// ---------------------------------------------------------------------------

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
