"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { CompiledHistoryResult, Role } from "@weeklyreport/shared";
import { useEffect, useMemo, useState } from "react";

import {
  isHeadLike,
  isLead as isLeadRole,
  isViewer,
} from "../../../shared/lib/auth/role-predicates";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import {
  type HistoryEntry,
  mapCompiledHistoryEntries,
  mapHistoryEntries,
} from "../../report-sections";

export interface HistoryView {
  readonly isLead: boolean;
  readonly entries: readonly HistoryEntry[];
  readonly archiveCount: number;
  readonly truncated: boolean;
  readonly isLoading: boolean;
  readonly failure: {
    readonly isRetrying: boolean;
    readonly retry: () => void;
  } | null;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (nextValue: boolean) => void;
}

function useHistoryQueryState(role: Role | null) {
  const trpc = useTRPC();
  const isLead = isLeadRole(role);
  const usesCompiledHistory = isHeadLike(role) || isViewer(role);

  // History defaults to the current (non-archived) view for every role; the
  // archive toggle is local state only, never derived from the URL.
  const [includeArchive, setArchiveScope] = useState(false);
  const [previousCompiledData, setPreviousCompiledData] =
    useState<CompiledHistoryResult>();

  const historyQ = useInfiniteQuery({
    ...trpc.reports.myHistory.infiniteQueryOptions(
      { limit: 50 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
    enabled: isLead,
  });

  const compiledHistoryQ = useQuery({
    ...trpc.reports.compiledHistory.queryOptions({ includeArchive }),
    enabled: usesCompiledHistory,
    placeholderData: (previousData) => previousData ?? previousCompiledData,
  });
  // Query placeholders disappear on failure; keep the displayed result across
  // archive scope changes until that scope returns its own data.
  const compiledData = compiledHistoryQ.data ?? previousCompiledData;
  const setIncludeArchive = (nextValue: boolean) => {
    setPreviousCompiledData(compiledData);
    setArchiveScope(nextValue);
  };

  const { hasNextPage, isError, isFetching, fetchNextPage } = historyQ;
  useEffect(() => {
    if (isLead && hasNextPage && !isError && !isFetching) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [hasNextPage, isError, isFetching, fetchNextPage, isLead]);

  return {
    isLead,
    usesCompiledHistory,
    includeArchive,
    setIncludeArchive,
    historyQ,
    compiledHistoryQ,
    compiledData,
  };
}

// Role selection also applies to cached data from disabled queries.
export function useHistoryData(role: Role | null): HistoryView {
  const {
    isLead,
    usesCompiledHistory,
    includeArchive,
    setIncludeArchive,
    historyQ,
    compiledHistoryQ,
    compiledData: loadedCompiledData,
  } = useHistoryQueryState(role);

  const allEntries = useMemo(() => {
    const history = isLead
      ? (historyQ.data?.pages.flatMap((page) => page.items) ?? [])
      : [];
    return mapHistoryEntries(history);
  }, [historyQ.data?.pages, isLead]);

  // Personal archive filtering applies locally. Compiled rows follow the server
  // scope, retaining the previous result while that scope loads or fails.
  const leadEntries = includeArchive
    ? allEntries
    : allEntries.filter((entry) => !entry.archived);

  const compiledData = usesCompiledHistory ? loadedCompiledData : undefined;
  const compiledEntries = useMemo(
    () => mapCompiledHistoryEntries(compiledData?.entries ?? []),
    [compiledData?.entries],
  );
  const query = isLead ? historyQ : compiledHistoryQ;
  const failure =
    (isLead || usesCompiledHistory) && query.isError
      ? {
          isRetrying: query.isFetching,
          retry: () => {
            if (isLead && historyQ.isFetchNextPageError) {
              void historyQ.fetchNextPage({ cancelRefetch: false });
            } else {
              void query.refetch({ cancelRefetch: false });
            }
          },
        }
      : null;

  return {
    isLead,
    entries: isLead ? leadEntries : compiledEntries,
    archiveCount: isLead
      ? allEntries.filter((entry) => entry.archived).length
      : (compiledData?.archiveCount ?? 0),
    truncated: compiledData?.truncated === true,
    failure,
    isLoading: isLead
      ? historyQ.isLoading
      : usesCompiledHistory
        ? compiledHistoryQ.isLoading
        : false,
    includeArchive,
    setIncludeArchive,
  };
}
