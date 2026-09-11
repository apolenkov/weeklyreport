import {
  onlineManager,
  QueryClient,
  QueryObserver,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { makeQueryState } from "./query-state";

interface DerivedFlags {
  readonly fetchStatus: QueryObserverResult["fetchStatus"];
  readonly isFetching: boolean;
  readonly isInitialLoading: boolean;
  readonly isLoading: boolean;
  readonly isPaused: boolean;
  readonly isPending: boolean;
  readonly isRefetching: boolean;
  readonly status: QueryObserverResult["status"];
}

function readBooleanProperty(object: object, key: string): boolean {
  const value: unknown = Reflect.get(object, key);
  if (typeof value !== "boolean") {
    throw new TypeError(`Expected ${key} to be boolean`);
  }
  return value;
}

function derivedFlags(result: QueryObserverResult): DerivedFlags {
  return {
    fetchStatus: result.fetchStatus,
    isFetching: result.isFetching,
    isInitialLoading: readBooleanProperty(result, "isInitialLoading"),
    isLoading: result.isLoading,
    isPaused: result.isPaused,
    isPending: result.isPending,
    isRefetching: result.isRefetching,
    status: result.status,
  };
}

function pendingQuery(): Promise<string> {
  return new Promise(() => undefined);
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("makeQueryState derived fetch flags", () => {
  it("matches pending idle and pending fetching QueryObserver results", () => {
    const client = new QueryClient();
    const idleObserver = new QueryObserver(client, {
      queryKey: ["pending-idle"],
      queryFn: pendingQuery,
      enabled: false,
    });
    const fetchingObserver = new QueryObserver(client, {
      queryKey: ["pending-fetching"],
      queryFn: pendingQuery,
    });
    const unsubscribe = fetchingObserver.subscribe(() => undefined);

    expect(
      derivedFlags(makeQueryState({ data: undefined, status: "pending" })),
    ).toEqual(derivedFlags(idleObserver.getCurrentResult()));
    expect(
      derivedFlags(makeQueryState({ data: undefined, isLoading: true })),
    ).toEqual(derivedFlags(fetchingObserver.getCurrentResult()));

    unsubscribe();
    client.clear();
  });

  it("matches background refetch and paused QueryObserver results", () => {
    const client = new QueryClient();
    client.setQueryData(["success-fetching"], "cached");
    const refetchingObserver = new QueryObserver(client, {
      queryKey: ["success-fetching"],
      queryFn: pendingQuery,
    });
    const unsubscribeRefetch = refetchingObserver.subscribe(() => undefined);

    onlineManager.setOnline(false);
    const pausedObserver = new QueryObserver(client, {
      queryKey: ["pending-paused"],
      queryFn: pendingQuery,
    });
    const unsubscribePaused = pausedObserver.subscribe(() => undefined);

    expect(
      derivedFlags(
        makeQueryState({
          data: "cached",
          status: "success",
          fetchStatus: "fetching",
        }),
      ),
    ).toEqual(derivedFlags(refetchingObserver.getCurrentResult()));
    expect(
      derivedFlags(
        makeQueryState({
          data: undefined,
          status: "pending",
          fetchStatus: "paused",
        }),
      ),
    ).toEqual(derivedFlags(pausedObserver.getCurrentResult()));

    unsubscribePaused();
    unsubscribeRefetch();
    client.clear();
  });

  it("keeps an explicit idle fetch status when isLoading is requested", () => {
    expect(
      derivedFlags(
        makeQueryState({
          data: undefined,
          isLoading: true,
          fetchStatus: "idle",
        }),
      ),
    ).toMatchObject({
      fetchStatus: "idle",
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isPending: true,
    });
  });
});
