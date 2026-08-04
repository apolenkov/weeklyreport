import { MS_PER_SECOND } from "@customreport/shared";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

import { getClientErrorDetails } from "./client-error-reporting";

// Query results are considered fresh for this many seconds before a refetch.
const STALE_TIME_SECONDS = 30;
const STALE_TIME_MS = STALE_TIME_SECONDS * MS_PER_SECOND;

// Preserve three transient retries; the 4xx predicate only short-circuits
// deterministic client errors.
const DEFAULT_QUERY_RETRY_COUNT = 3;

// Deterministic client errors (4xx / BAD_REQUEST / NOT_FOUND) cannot succeed on retry.
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
        staleTime: STALE_TIME_MS,
        refetchOnWindowFocus: true,
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
