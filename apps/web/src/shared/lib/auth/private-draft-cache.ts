import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { MyHistoryResult } from "@weeklyreport/shared";

import type { TRPCProxy } from "../trpc/trpc";

type HistoryCache = MyHistoryResult | InfiniteData<MyHistoryResult>;

function withoutPrivateDiscovery(page: MyHistoryResult): MyHistoryResult {
  return {
    ...page,
    items: page.items.map((entry) => {
      if (!entry.retainedDrafts) return entry;
      const completeEntry = { ...entry };
      delete completeEntry.retainedDrafts;
      return completeEntry;
    }),
  };
}

/** Called with session children unmounted: removing a query alone leaves mounted observers stale. */
export async function clearPrivateDraftCache(
  client: QueryClient,
  trpc: TRPCProxy,
  preserveCompleteHistory: boolean,
): Promise<void> {
  const privateQueries = [
    trpc.reports.getActive.pathFilter(),
    trpc.leadForm.byPeriod.pathFilter(),
    trpc.leadForm.retainedIncompleteRecords.pathFilter(),
  ];
  const history = trpc.reports.myHistory.pathFilter();
  await Promise.all(
    [...privateQueries, history].map((filter) => client.cancelQueries(filter)),
  );
  for (const filter of privateQueries) client.removeQueries(filter);
  if (!preserveCompleteHistory) {
    client.removeQueries(history);
    return;
  }
  client.setQueriesData<HistoryCache>(history, (cached) => {
    if (!cached) return cached;
    return "pages" in cached
      ? { ...cached, pages: cached.pages.map(withoutPrivateDiscovery) }
      : withoutPrivateDiscovery(cached);
  });
  await client.invalidateQueries({ ...history, refetchType: "none" });
}
