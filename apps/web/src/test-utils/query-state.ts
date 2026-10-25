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
  isPlaceholderData: false,
  isStale: false,
} as const;

// TanStack Query v5 still types the deprecated `isInitialLoading` as a required
// result field (always equal to `isLoading`). Building it here, as an untyped
// object spread into the result, keeps the field the contract demands without
// naming the deprecated key inside every typed result literal.
export function legacyInitialLoading(isLoading: boolean) {
  return { isInitialLoading: isLoading };
}

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
  const fetchStatus =
    input.fetchStatus ?? (input.isLoading ? "fetching" : "idle");
  const isFetching = fetchStatus === "fetching";
  const isPending = status === "pending";
  const isLoading = isPending && isFetching;
  const legacyFlags = legacyInitialLoading(isLoading);
  const isPaused = fetchStatus === "paused";
  const isRefetching = isFetching && !isPending;
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
      ...legacyFlags,
      isLoading,
      isLoadingError: false,
      isPaused,
      isPending: true,
      isRefetchError: false,
      isRefetching,
      isSuccess: false,
      refetch,
      status,
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
        ...legacyFlags,
        isLoading: false,
        isLoadingError: true,
        isPaused,
        isPending: false,
        isRefetchError: false,
        isRefetching,
        isSuccess: false,
        refetch,
        status: "error",
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
      ...legacyFlags,
      isLoading: false,
      isLoadingError: false,
      isPaused,
      isPending: false,
      isRefetchError: true,
      isRefetching,
      isSuccess: false,
      refetch,
      status: "error",
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
    ...legacyFlags,
    isLoading: false,
    isLoadingError: false,
    isPaused,
    isPending: false,
    isRefetchError: false,
    isRefetching,
    isSuccess: true,
    refetch,
    status: "success",
  };
}
