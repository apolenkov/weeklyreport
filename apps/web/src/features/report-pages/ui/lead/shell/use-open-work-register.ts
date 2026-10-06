"use client";

import type {
  LeadOpenWorkHistoryOccurrence,
  LeadOpenWorkHistoryOutput,
  ReportSectionReadModel,
} from "@customreport/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import {
  type OpenWorkRegisterItem,
  projectOpenWorkRegister,
} from "./open-work-register-model";

const OPEN_WORK_PAGE_SIZE = 25;
type CurrentItem = Pick<ReportSectionReadModel["items"][number], "stableId">;

export interface OpenWorkRegisterQuery {
  readonly openItems: readonly OpenWorkRegisterItem[];
  readonly terminalItems: readonly OpenWorkRegisterItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly retry: () => void;
}

function repeatedCursor(
  pages: readonly LeadOpenWorkHistoryOutput[] | undefined,
  pageParams: readonly unknown[] | undefined,
): boolean {
  const next = pages?.at(-1)?.nextCursor;
  return (
    next !== null && next !== undefined && pageParams?.includes(next) === true
  );
}

/** Automatically exhausts report-keyset pages so gaps never truncate the register. */
export function useOpenWorkRegister(
  reportId: string,
  currentItems: readonly CurrentItem[],
): OpenWorkRegisterQuery {
  const trpc = useTRPC();
  const query = useInfiniteQuery(
    trpc.leadForm.openWork.infiniteQueryOptions(
      { reportId, limit: OPEN_WORK_PAGE_SIZE },
      {
        getNextPageParam: (lastPage: LeadOpenWorkHistoryOutput) =>
          lastPage.nextCursor ?? undefined,
      },
    ),
  );
  const {
    data,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    refetch,
  } = query;
  const cursorLoop = repeatedCursor(data?.pages, data?.pageParams);
  const pageFailed = isError || isFetchNextPageError;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !pageFailed && !cursorLoop) {
      void fetchNextPage();
    }
  }, [cursorLoop, fetchNextPage, hasNextPage, isFetchingNextPage, pageFailed]);

  const occurrences = useMemo(
    () =>
      (data?.pages ?? []).flatMap(
        (page): readonly LeadOpenWorkHistoryOccurrence[] => page.occurrences,
      ),
    [data?.pages],
  );
  const register = useMemo(
    () => projectOpenWorkRegister(occurrences, currentItems),
    [currentItems, occurrences],
  );
  const error = cursorLoop
    ? "Earlier periods returned a repeated cursor. The open-work register may be incomplete."
    : pageFailed
      ? queryError instanceof Error
        ? queryError.message
        : "Open work could not be loaded."
      : null;

  return {
    openItems: register.openItems,
    terminalItems: register.terminalItems,
    isLoading: isLoading || isFetchingNextPage,
    error,
    retry: () => {
      void refetch();
    },
  };
}
