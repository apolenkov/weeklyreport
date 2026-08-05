"use client";

import type { MyHistoryEntry, Role } from "@customreport/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  isHeadLike,
  isLead as isLeadRole,
  isViewer,
} from "../../../lib/role-predicates";
import { useTRPC } from "../../../lib/trpc-context";
import {
  type HistoryEntry,
  mapCompiledHistoryEntries,
  mapHistoryEntries,
} from "../../report-sections";

export interface HistoryView {
  readonly isLead: boolean;
  readonly entries: readonly HistoryEntry[];
  readonly archiveCount: number;
  readonly isLoading: boolean;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (nextValue: boolean) => void;
}

function useHistoryQueryState(role: Role | null) {
  const trpc = useTRPC();
  const isLead = isLeadRole(role);
  const usesCompiledHistory = isHeadLike(role) || isViewer(role);

  // History defaults to the current (non-archived) view for every role; the
  // archive toggle is local state only, never derived from the URL.
  const [includeArchive, setIncludeArchive] = useState(false);

  const historyQ = useQuery({
    ...trpc.reports.myHistory.queryOptions(),
    enabled: isLead,
  });

  const compiledHistoryQ = useQuery({
    ...trpc.reports.compiledHistory.queryOptions({ includeArchive }),
    enabled: usesCompiledHistory,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isLead && historyQ.isError) {
      toast.error(historyQ.error.message);
    }
    if (usesCompiledHistory && compiledHistoryQ.isError) {
      toast.error(compiledHistoryQ.error.message);
    }
  }, [
    compiledHistoryQ.error,
    compiledHistoryQ.isError,
    historyQ.error,
    historyQ.isError,
    isLead,
    usesCompiledHistory,
  ]);

  return {
    isLead,
    usesCompiledHistory,
    includeArchive,
    setIncludeArchive,
    historyQ,
    compiledHistoryQ,
  };
}

// One role-defaulted history view: a lead reads their personal history, every
// other role reads the compiled one. Only the enabled query ever has data.
export function useHistoryData(role: Role | null): HistoryView {
  const {
    isLead,
    usesCompiledHistory,
    includeArchive,
    setIncludeArchive,
    historyQ,
    compiledHistoryQ,
  } = useHistoryQueryState(role);

  const allEntries = useMemo(() => {
    const history =
      isLead && Array.isArray(historyQ.data)
        ? (historyQ.data as readonly MyHistoryEntry[])
        : [];
    return mapHistoryEntries(history);
  }, [historyQ.data, isLead]);

  // A lead's archived rows are filtered client-side; the compiled query already
  // returns exactly the rows its includeArchive argument asked for.
  const leadEntries = includeArchive
    ? allEntries
    : allEntries.filter((entry) => !entry.archived);

  const compiledData = usesCompiledHistory ? compiledHistoryQ.data : undefined;
  const compiledEntries = useMemo(
    () => mapCompiledHistoryEntries(compiledData?.entries ?? []),
    [compiledData?.entries],
  );

  return {
    isLead,
    entries: isLead ? leadEntries : compiledEntries,
    archiveCount: isLead
      ? allEntries.filter((entry) => entry.archived).length
      : (compiledData?.archiveCount ?? 0),
    isLoading: isLead
      ? historyQ.isLoading
      : usesCompiledHistory
        ? compiledHistoryQ.isLoading
        : false,
    includeArchive,
    setIncludeArchive,
  };
}
