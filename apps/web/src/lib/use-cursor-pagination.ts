'use client';

/**
 * Generic cursor pagination hook for tRPC endpoints that follow the
 * `{ cursor?: string; limit?: number } -> { items: T[]; nextCursor: string | null }`
 * shape (matching `paginationInputSchema` / `PaginatedResult<T>` in
 * `@customreport/shared`).
 *
 * Wraps `useInfiniteQuery` from `@tanstack/react-query` and is designed to
 * accept a factory equivalent to
 * `trpc.<router>.<proc>.infiniteQueryOptions(input, opts)` exposed by
 * `@trpc/tanstack-react-query` (verified present at v11.16.0). The factory
 * may also be a hand-rolled object compatible with `useInfiniteQuery`'s
 * options — used for unit testing without a real tRPC client.
 *
 * Example:
 * ```tsx
 * const trpc = useTRPC();
 * const archive = useCursorPagination(
 *   (input) => trpc.archive.list.infiniteQueryOptions(input, {
 *     getNextPageParam: (last) => last.nextCursor ?? undefined,
 *   }),
 *   { limit: 20 },
 * );
 * archive.items.map(...);
 * archive.fetchNextPage();
 * ```
 *
 * The hook is intentionally thin: pages are flattened to `items`, and the
 * original `useInfiniteQuery` flags are surfaced under stable, ergonomic
 * names. No request side-effects beyond what `useInfiniteQuery` performs.
 */

import { useMemo } from 'react';
import { useInfiniteQuery, type UseInfiniteQueryOptions } from '@tanstack/react-query';

export type CursorPaginationInput = {
  cursor?: string;
  limit?: number;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type CursorPaginationOptions = {
  /** When false, the underlying query is disabled and no fetch occurs. */
  enabled?: boolean;
};

export type CursorPaginationResult<T> = {
  /** Flattened list of items across all loaded pages. Empty when no data. */
  items: T[];
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: unknown;
  fetchNextPage: () => void;
};

/**
 * Factory signature: a function that takes the cursor-paginated input and
 * returns options compatible with TanStack Query's `useInfiniteQuery`. This
 * matches `trpc.<router>.<proc>.infiniteQueryOptions(input)` shape.
 */
export type CursorQueryOptionsFactory<
  TInput extends CursorPaginationInput,
  TItem,
> = (input: TInput) => UseInfiniteQueryOptions<
  CursorPage<TItem>,
  unknown,
  CursorPage<TItem>,
  readonly unknown[],
  string | null | undefined
>;

export function useCursorPagination<
  TItem,
  TInput extends CursorPaginationInput = CursorPaginationInput,
>(
  factory: CursorQueryOptionsFactory<TInput, TItem> | ((input: TInput) => unknown),
  input: Omit<TInput, 'cursor'>,
  options: CursorPaginationOptions = {},
): CursorPaginationResult<TItem> {
  // Build the query options from the provided factory. We keep the cast
  // narrow so consumer factories typed against the tRPC proxy still satisfy
  // useInfiniteQuery's typings.
  const queryOptions = useMemo(() => {
    const built = (factory as CursorQueryOptionsFactory<TInput, TItem>)(
      input as TInput,
    );
    return {
      ...built,
      enabled: options.enabled,
    } as UseInfiniteQueryOptions<
      CursorPage<TItem>,
      unknown,
      CursorPage<TItem>,
      readonly unknown[],
      string | null | undefined
    >;
    // factory is typically referentially stable per render only when the caller
    // wraps it in useCallback. Including `input`/`options.enabled` in the deps
    // keeps queryKey changes propagating correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input), options.enabled]);

  const query = useInfiniteQuery(queryOptions);

  const items = useMemo<TItem[]>(() => {
    const pages = query.data?.pages;
    if (!pages) return [];
    return pages.flatMap((p) => p.items);
  }, [query.data]);

  return {
    items,
    hasNextPage: !!query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}
