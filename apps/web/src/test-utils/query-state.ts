// Typed react-query state factory: builds a real QueryObserverResult so tests
// exercise the contract react-query's consumers read, instead of erasing it
// with `as unknown as ReturnType<typeof useQuery>`.
import type { QueryObserverResult } from "@tanstack/react-query";

type QueryFetchStatus = "fetching" | "paused" | "idle";

export interface QueryStateInput<TData, TError = Error> {
  readonly data: TData;
  readonly error?: TError | null;
  readonly isLoading?: boolean;
  readonly status?: "pending" | "error" | "success";
  readonly fetchStatus?: QueryFetchStatus;
  readonly refetch?: () => Promise<unknown>;
}

const BASE = {
  dataUpdatedAt: 0,
  isEnabled: true,
  errorUpdatedAt: 0,
  failureCount: 0,
  errorUpdateCount: 0,
  isFetched: true,
  isFetchedAfterMount: true,
  isFetching: false,
  isInitialLoading: false,
  isPaused: false,
  isPlaceholderData: false,
  isRefetching: false,
  isStale: false,
} as const;

function resolveRefetch<TData, TError = Error>(
  input: QueryStateInput<TData, TError>,
): QueryObserverResult<TData, TError>["refetch"] {
  return async () => {
    const { refetch, ...nextInput } = input;
    await refetch?.();
    return makeQueryState(nextInput);
  };
}

export function makeQueryState<TData, TError = Error>(
  input: QueryStateInput<TData, TError>,
): QueryObserverResult<TData, TError> {
  const error = input.error ?? null;
  const status =
    input.status ??
    (input.isLoading ? "pending" : error !== null ? "error" : "success");
  const fetchStatus = input.fetchStatus ?? "idle";
  const isFetching = fetchStatus === "fetching";
  const refetch = resolveRefetch(input);

  if (status === "pending") {
    return {
      ...BASE,
      data: undefined,
      error: null,
      failureReason: null,
      fetchStatus,
      isError: false,
      isFetching,
      isLoading: true,
      isLoadingError: false,
      isPending: true,
      isRefetchError: false,
      isSuccess: false,
      refetch,
      status,
      promise: new Promise<TData>(() => undefined),
    };
  }

  if (status === "error" || error !== null) {
    const resolvedError = error ?? (new Error("query failed") as TError);
    if (input.data === undefined) {
      return {
        ...BASE,
        data: undefined,
        error: resolvedError,
        failureReason: resolvedError,
        fetchStatus,
        isError: true,
        isFetching,
        isLoading: false,
        isLoadingError: true,
        isPending: false,
        isRefetchError: false,
        isSuccess: false,
        refetch,
        status: "error",
        promise: new Promise<TData>(() => undefined),
      };
    }
    return {
      ...BASE,
      data: input.data,
      error: resolvedError,
      failureReason: resolvedError,
      fetchStatus,
      isError: true,
      isFetching,
      isLoading: false,
      isLoadingError: false,
      isPending: false,
      isRefetchError: true,
      isSuccess: false,
      refetch,
      status: "error",
      promise: new Promise<TData>(() => undefined),
    };
  }

  return {
    ...BASE,
    data: input.data,
    error: null,
    failureReason: null,
    fetchStatus,
    isError: false,
    isFetching,
    isLoading: false,
    isLoadingError: false,
    isPending: false,
    isRefetchError: false,
    isSuccess: true,
    refetch,
    status: "success",
    promise: Promise.resolve(input.data),
  };
}
