/**
 * @vitest-environment jsdom
 *
 * T-F4-4 §23.4 — queryKey deduplication regression guard.
 *
 * Both Activity24hCard and ActivityLivePanel must call
 * trpc.activity.live.queryOptions() with identical arguments so that
 * TanStack Query deduplicates their network requests.  This test catches a
 * future refactor that passes different args to either component, which would
 * silently break deduplication and cause two separate fetches.
 */
import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- spies ---------------------------------------------------------------

type QueryKey = unknown[];
interface QueryOptions {
  queryKey: QueryKey;
}

const queryOptionsSpy = vi.fn(
  (arg?: unknown): QueryOptions => ({
    // Return a key that encodes the argument so diverging args produce
    // different keys — the same trick the real tRPC adapter uses.
    queryKey: arg === undefined ? ["activity.live"] : ["activity.live", arg],
  }),
);

const useQuerySpy = vi.fn((_options: QueryOptions) => ({
  data: undefined,
  isLoading: false,
  isError: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => useQuerySpy(options),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    activity: {
      live: {
        queryOptions: (arg?: unknown) => queryOptionsSpy(arg),
      },
    },
  }),
}));

// --- components (imported AFTER mocks are installed) ---------------------

import { Activity24hCard } from "./activity-24h-card";
import { ActivityLivePanel } from "./activity-live-panel";

// -------------------------------------------------------------------------

describe("activity.live queryKey deduplication guard", () => {
  beforeEach(() => {
    queryOptionsSpy.mockClear();
    useQuerySpy.mockClear();
  });

  it("Activity24hCard and ActivityLivePanel resolve identical queryKeys", () => {
    // Render the 24h card and capture the queryOptions args it used.
    render(<Activity24hCard />);
    expect(queryOptionsSpy).toHaveBeenCalledTimes(1);
    const key24h: QueryKey = useQuerySpy.mock.calls[0]?.[0]?.queryKey ?? [];

    queryOptionsSpy.mockClear();
    useQuerySpy.mockClear();

    // Render the live panel and capture its queryOptions args.
    render(<ActivityLivePanel />);
    expect(queryOptionsSpy).toHaveBeenCalledTimes(1);
    const keyLive: QueryKey = useQuerySpy.mock.calls[0]?.[0]?.queryKey ?? [];

    // The two keys must be deeply equal — if a future refactor passes
    // different arguments to either component, this assertion catches it
    // before the deduplication silently breaks in production.
    expect(key24h).toEqual(keyLive);
  });

  it("queryOptions spy produces different keys for different args (sanity check)", () => {
    const keyNoArg = queryOptionsSpy();
    const keyWithArg = queryOptionsSpy({ leadId: "x" });
    expect(keyNoArg.queryKey).not.toEqual(keyWithArg.queryKey);
  });
});
