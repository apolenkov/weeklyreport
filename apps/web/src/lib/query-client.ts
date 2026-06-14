import {
  defaultShouldDehydrateQuery,
  keepPreviousData,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

import { getClientErrorDetails } from "./client-error-reporting";

/**
 * TanStack default retry count for transient failures (5xx / network). Kept
 * explicit so the 4xx-skip predicate only short-circuits deterministic client
 * errors and preserves the default count for everything else.
 */
const DEFAULT_QUERY_RETRY_COUNT = 3;

/**
 * Retry predicate for the query client. A deterministic client error (4xx /
 * Zod `BAD_REQUEST` / `NOT_FOUND`) cannot succeed on retry, so it fails once;
 * transient errors keep the TanStack default count (driver finding 1:
 * a malformed `reportId` was retried 3× — observed 207/400/400/400).
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (getClientErrorDetails(error).isDeterministicClientError) {
    return false;
  }
  return failureCount < DEFAULT_QUERY_RETRY_COUNT;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
        // A20: prevent blank flash during refetch (autosave → invalidate cycle).
        // Shows previous data while new data loads instead of unmounting UI.
        placeholderData: keepPreviousData,
        // Driver finding 1: skip retrying deterministic 4xx (a malformed
        // reportId fails once, not 1 + 3 retries). See shouldRetryQuery.
        retry: shouldRetryQuery,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
