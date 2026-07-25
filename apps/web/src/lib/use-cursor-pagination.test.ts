// The `infiniteQueryOptions` factory is stubbed directly so these tests need no
// real tRPC client.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { useCursorPagination } from "./use-cursor-pagination";

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return { client, Wrapper };
}

function makeFactory<T>(
  pages: Record<string, Page<T>>,
  baseQueryKey: readonly unknown[],
) {
  return (input: { cursor?: string; limit?: number }) => ({
    queryKey: [...baseQueryKey, { limit: input.limit }] as const,
    initialPageParam: undefined as string | undefined,
    // eslint-disable-next-line @typescript-eslint/require-await -- async required by queryFn contract; synchronous stub but must satisfy Promise return type
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const key = pageParam ?? "__first__";
      const page = pages[key];
      if (!page) throw new Error(`Unknown page cursor: ${key}`);
      return page;
    },
    getNextPageParam: (last: Page<T>) => last.nextCursor ?? undefined,
  });
}

describe("useCursorPagination", () => {
  it("returns first page items + hasNextPage=true after initial load", async () => {
    const { Wrapper } = makeWrapper();
    const factory = makeFactory(
      {
        __first__: { items: ["a", "b", "c"], nextCursor: "cursor-2" },
        "cursor-2": { items: ["d", "e", "f"], nextCursor: null },
      },
      ["archive", "list"],
    );

    const { result } = renderHook(
      () => useCursorPagination(factory, { limit: 3 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual(["a", "b", "c"]);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("appends next page items when fetchNextPage is called", async () => {
    const { Wrapper } = makeWrapper();
    const factory = makeFactory(
      {
        __first__: { items: ["a", "b", "c"], nextCursor: "cursor-2" },
        "cursor-2": { items: ["d", "e", "f"], nextCursor: null },
      },
      ["archive", "list"],
    );

    const { result } = renderHook(
      () => useCursorPagination(factory, { limit: 3 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(3);

    // eslint-disable-next-line @typescript-eslint/require-await -- async required by act() signature; body has no awaitable work in this step
    await act(async () => {
      result.current.fetchNextPage();
    });

    await waitFor(() =>
      expect(result.current.items).toEqual(["a", "b", "c", "d", "e", "f"]),
    );
  });

  it("sets hasNextPage=false once the server returns nextCursor=null", async () => {
    const { Wrapper } = makeWrapper();
    const factory = makeFactory(
      {
        __first__: { items: ["only"], nextCursor: null },
      },
      ["archive", "list"],
    );

    const { result } = renderHook(
      () => useCursorPagination(factory, { limit: 1 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("exposes isError and error when the queryFn throws", async () => {
    const { Wrapper } = makeWrapper();
    // Silence TanStack's expected error log for this test.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* intentionally empty: suppress TanStack expected-error log for this test */
    });
    const factory = (input: { cursor?: string; limit?: number }) => ({
      queryKey: ["archive", "list", { limit: input.limit }] as const,
      initialPageParam: undefined as string | undefined,
      // eslint-disable-next-line @typescript-eslint/require-await -- async required by queryFn contract; throws synchronously but must satisfy Promise return type
      queryFn: async () => {
        throw new Error("boom");
      },
      getNextPageParam: () => undefined,
    });

    const { result } = renderHook(
      () => useCursorPagination(factory, { limit: 5 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("boom");
    expect(result.current.items).toEqual([]);

    errSpy.mockRestore();
  });

  it("does not fetch when enabled=false", async () => {
    const { Wrapper } = makeWrapper();
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async queryFn contract (no awaitable work in the stub)
    const queryFn = vi.fn(async () => ({ items: [], nextCursor: null }));
    const factory = (input: { cursor?: string; limit?: number }) => ({
      queryKey: ["archive", "list", { limit: input.limit }] as const,
      initialPageParam: undefined as string | undefined,
      queryFn,
      getNextPageParam: () => undefined,
    });

    renderHook(
      () => useCursorPagination(factory, { limit: 5 }, { enabled: false }),
      { wrapper: Wrapper },
    );

    await act(() => Promise.resolve());
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("preserves a factory-set enabled=false when enabled is omitted", async () => {
    const { Wrapper } = makeWrapper();
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async queryFn contract (no awaitable work in the stub)
    const queryFn = vi.fn(async () => ({ items: [], nextCursor: null }));
    const factory = (input: { cursor?: string; limit?: number }) => ({
      queryKey: ["archive", "list", { limit: input.limit }] as const,
      initialPageParam: undefined as string | undefined,
      queryFn,
      getNextPageParam: () => undefined,
      enabled: false,
    });

    renderHook(() => useCursorPagination(factory, { limit: 5 }), {
      wrapper: Wrapper,
    });

    await act(() => Promise.resolve());
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("lets an explicit enabled=true override factory-set enabled=false", async () => {
    const { Wrapper } = makeWrapper();
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async queryFn contract (no awaitable work in the stub)
    const queryFn = vi.fn(async () => ({
      items: ["loaded"],
      nextCursor: null,
    }));
    const factory = (input: { cursor?: string; limit?: number }) => ({
      queryKey: ["archive", "list", { limit: input.limit }] as const,
      initialPageParam: undefined as string | undefined,
      queryFn,
      getNextPageParam: () => undefined,
      enabled: false,
    });

    const { result } = renderHook(
      () => useCursorPagination(factory, { limit: 5 }, { enabled: true }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.items).toEqual(["loaded"]));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
