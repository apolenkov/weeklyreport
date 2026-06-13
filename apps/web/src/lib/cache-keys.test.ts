/**
 * Phase 22 (plan 22-05) — cache invalidation cascade verification.
 *
 * The plan's Task 2 calls for confirming that `invalidateDashboard` cascades
 * to the queries the head's Publish & Lock flow expects to refresh:
 *   - review.dashboard
 *   - archive.list
 *   - weeklyReport.get
 *
 * We assert against the QueryClient's `invalidateQueries` calls instead of
 * driving a full UI render — the component-level tests already cover that
 * path; this test guarantees the helper itself routes correctly so any future
 * regression in cache-keys.ts is caught here.
 */

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateAdmin,
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "./cache-keys";
import type { TRPCProxy } from "./trpc";

// Build a stub trpc proxy where each `pathFilter()` returns a tagged object so
// we can assert which filters were passed to `invalidateQueries`.
function makeStubTrpc(): TRPCProxy {
  return {
    review: {
      dashboard: { pathFilter: () => ({ tag: "review.dashboard" }) },
    },
    archive: {
      list: { pathFilter: () => ({ tag: "archive.list" }) },
    },
    weeklyReport: {
      get: { pathFilter: () => ({ tag: "weeklyReport.get" }) },
    },
    reports: {
      getActive: { pathFilter: () => ({ tag: "reports.getActive" }) },
      myHistory: { pathFilter: () => ({ tag: "reports.myHistory" }) },
    },
    leadForm: {
      byPeriod: { pathFilter: () => ({ tag: "leadForm.byPeriod" }) },
    },
    admin: {
      snapshot: { pathFilter: () => ({ tag: "admin.snapshot" }) },
      getSettings: { pathFilter: () => ({ tag: "admin.getSettings" }) },
      // UFB-047 / Phase 48-A: invalidateAdmin also flushes the org caches
      // so brand renames propagate immediately after a Save in the
      // Identity tab.
      getOrganization: { pathFilter: () => ({ tag: "admin.getOrganization" }) },
    },
    auth: {
      me: { pathFilter: () => ({ tag: "auth.me" }) },
    },
    org: {
      getPublic: { pathFilter: () => ({ tag: "org.getPublic" }) },
    },
  } as unknown as TRPCProxy;
}

describe("cache-keys helpers", () => {
  it("invalidateDashboard fires invalidateQueries for review.dashboard, archive.list, weeklyReport.get", () => {
    const qc = new QueryClient();
    const spy = vi
      .spyOn(qc, "invalidateQueries")
      .mockReturnValue(Promise.resolve());
    const trpc = makeStubTrpc();

    invalidateDashboard(qc, trpc);

    const tags = spy.mock.calls.map(
      (c) => (c.at(0) as { tag?: string } | undefined)?.tag,
    );
    expect(tags).toContain("review.dashboard");
    expect(tags).toContain("archive.list");
    expect(tags).toContain("weeklyReport.get");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("invalidateLeadForm covers reports.getActive + leadForm.byPeriod", () => {
    const qc = new QueryClient();
    const spy = vi
      .spyOn(qc, "invalidateQueries")
      .mockReturnValue(Promise.resolve());
    invalidateLeadForm(qc, makeStubTrpc());

    const tags = spy.mock.calls.map(
      (c) => (c.at(0) as { tag?: string } | undefined)?.tag,
    );
    expect(tags).toEqual(
      expect.arrayContaining(["reports.getActive", "leadForm.byPeriod"]),
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("invalidateLeadHistory targets reports.myHistory", () => {
    const qc = new QueryClient();
    const spy = vi
      .spyOn(qc, "invalidateQueries")
      .mockReturnValue(Promise.resolve());
    invalidateLeadHistory(qc, makeStubTrpc());

    expect(spy.mock.calls[0]?.[0]).toEqual({ tag: "reports.myHistory" });
  });

  it("invalidateAdmin targets admin.snapshot + admin.getSettings + org caches (UFB-047)", () => {
    const qc = new QueryClient();
    const spy = vi
      .spyOn(qc, "invalidateQueries")
      .mockReturnValue(Promise.resolve());
    invalidateAdmin(qc, makeStubTrpc());

    const tags = spy.mock.calls.map(
      (c) => (c.at(0) as { tag?: string } | undefined)?.tag,
    );
    expect(tags).toEqual(
      expect.arrayContaining([
        "admin.snapshot",
        "admin.getSettings",
        // UFB-047 / Phase 48-A: brand rename must invalidate the org
        // caches and the auth.me session so the chrome refreshes.
        "admin.getOrganization",
        "org.getPublic",
        "auth.me",
      ]),
    );
  });
});
