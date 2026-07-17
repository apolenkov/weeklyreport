/**
 * Contract tests for createMockTRPC.
 *
 * Pins:
 *  (a) pathFilter() returns { queryKey: [splitPath] } — fails under the old
 *      { tag } shape.
 *  (b) invalidateQueries(pathFilter()) marks ONLY the matching query stale
 *      (negative assertion on an unrelated seeded query).
 *  (c) A "pending" descriptor keeps useQuery isPending.
 *  (d) Mutation capture records mutationFn input and caller-passed callbacks.
 */

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../lib/trpc-context";
import { createMockTRPC } from "./mock-trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- contract assertion on dynamic proxy
    const filter = (proxy as any).admin.getOrganization.pathFilter() as unknown;
    expect(filter).toEqual({ queryKey: [["admin", "getOrganization"]] });
    // Old vacuous shape must NOT be present.
    expect(filter).not.toHaveProperty("tag");
  });

  it("pathFilter() queryKey equals [[...splitPath]] for a 3-segment path", () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "jobs", "listFailed"], query: [] },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- contract assertion on dynamic proxy
    const filter = (proxy as any).admin.jobs.listFailed.pathFilter() as {
      queryKey: unknown;
    };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- seeding query via proxy contract
    const orgOpts = (proxy as any).admin.getOrganization.queryOptions() as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- seeding query via proxy contract
    const settingsOpts = (proxy as any).admin.getSettings.queryOptions() as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };

    await qc.fetchQuery(orgOpts);
    await qc.fetchQuery(settingsOpts);

    // Both queries are now fresh.
    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);

    // Invalidate only getOrganization via its pathFilter.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- contract assertion on dynamic proxy
    const proxyAny = proxy as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- contract assertion on dynamic proxy
    const filter = proxyAny.admin.getOrganization.pathFilter() as Parameters<
      typeof qc.invalidateQueries
    >[0];
    await qc.invalidateQueries(filter);

    // getOrganization is stale; getSettings is NOT.
    expect(qc.getQueryState(orgOpts.queryKey)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(settingsOpts.queryKey)?.isInvalidated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (c) "pending" descriptor keeps useQuery isPending
// ---------------------------------------------------------------------------

describe("createMockTRPC — pending descriptor", () => {
  // Typed view of the dynamic proxy for this test's single path — avoids
  // unsafe-any access on the chained call.
  interface ListFailedProxy {
    admin: {
      jobs: {
        listFailed: { queryOptions: () => Parameters<typeof useQuery>[0] };
      };
    };
  }

  it('a "pending" descriptor keeps useQuery in isPending state', async () => {
    const { proxy } = createMockTRPC([
      { path: ["admin", "jobs", "listFailed"], query: "pending" },
    ]);
    const { Wrapper } = makeWrapper(proxy);

    const { result } = renderHook(
      () => {
        const opts = (
          proxy as unknown as ListFailedProxy
        ).admin.jobs.listFailed.queryOptions();
        return useQuery(opts);
      },
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      // Never resolves — stays pending.
      expect(result.current.isPending).toBe(true);
    });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- proxy access for test
    const opts = (proxy as any).admin.updateOrganization.mutationOptions({
      onSuccess,
      onError,
    }) as { mutationFn: (vars: unknown) => Promise<unknown> };

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- proxy access for test
    (proxy as any).reports.saveDraft.mutationOptions({ onSuccess, onError });

    const entry = captured["reports.saveDraft"];
    expect(entry).toBeDefined();
    expect(entry?.lastOptions.onSuccess).toBe(onSuccess);
    expect(entry?.lastOptions.onError).toBe(onError);
  });
});
