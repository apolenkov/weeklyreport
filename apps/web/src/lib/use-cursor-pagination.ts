"use client";

// Thin useInfiniteQuery wrapper for cursor-paginated tRPC endpoints
// (`paginationInputSchema` / `PaginatedResult<T>` in @customreport/shared).

import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";

export interface CursorPaginationInput {
  cursor?: string;
  limit?: number;
}

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPaginationOptions {
  enabled?: boolean;
}

export interface CursorPaginationResult<T> {
  items: T[];
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: unknown;
  fetchNextPage: () => void;
}

export type CursorQueryOptionsFactory<
  TInput extends CursorPaginationInput,
  TItem,
> = (
  input: TInput,
) => UseInfiniteQueryOptions<
  CursorPage<TItem>,
  unknown,
  CursorPage<TItem>,
  readonly unknown[],
  string | null | undefined
>;

function mergeQueryOptions<TItem>(
  built: UseInfiniteQueryOptions<
    CursorPage<TItem>,
    unknown,
    CursorPage<TItem>,
    readonly unknown[],
    string | null | undefined
  >,
  options: CursorPaginationOptions,
): UseInfiniteQueryOptions<
  CursorPage<TItem>,
  unknown,
  CursorPage<TItem>,
  readonly unknown[],
  string | null | undefined
> {
  return {
    ...built,
    enabled: options.enabled ?? built.enabled,
  };
}

/**
 * Infinite query helper over a cursor-paginated tRPC procedure.
 * @param factory - Builds the infinite query options for the procedure.
 */
export function useCursorPagination<
  TItem,
  TInput extends CursorPaginationInput = CursorPaginationInput,
>(
  factory:
    CursorQueryOptionsFactory<TInput, TItem> | ((input: TInput) => unknown),
  input: Omit<TInput, "cursor">,
  options: CursorPaginationOptions = {},
): CursorPaginationResult<TItem> {
  // Factory is cheap; useInfiniteQuery keys by queryKey so input identity need
  // not be memoized.

  // The `unknown` arm and this cast exist because tRPC's
  // `infiniteQueryOptions` returns a branded options type (own error and
  // page-param shapes) that is not assignable to `UseInfiniteQueryOptions`.
  const built = (factory as CursorQueryOptionsFactory<TInput, TItem>)(
    input as TInput,
  );
  const queryOptions = mergeQueryOptions<TItem>(built, options);

  const query = useInfiniteQuery(queryOptions);

  const items = useMemo<TItem[]>(() => {
    const data = query.data as InfiniteData<CursorPage<TItem>> | undefined;
    const pages = data?.pages;
    if (!pages) return [];
    return pages.flatMap((p: CursorPage<TItem>) => p.items);
  }, [query.data]);

  return {
    items,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}
