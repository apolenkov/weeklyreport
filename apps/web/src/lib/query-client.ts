import {
  defaultShouldDehydrateQuery,
  keepPreviousData,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
        // A20: prevent blank flash during refetch (autosave → invalidate cycle).
        // Shows previous data while new data loads instead of unmounting UI.
        placeholderData: keepPreviousData,
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
