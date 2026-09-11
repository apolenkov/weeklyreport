// pathFilter/queryKey/queryOptions derive from one path so they cannot diverge.
import { vi } from "vitest";

import type { TRPCProxy } from "../shared/lib/trpc/trpc";

export interface ProcedureDescriptor {
  path: string[];
  // value | factory | "pending" (never resolves). Prefer queryByInput for parameterized queries.
  query?: unknown;
  // Input-aware stub; input lands in queryKey so distinct inputs cache separately. Incompatible with query.
  queryByInput?: (input: unknown) => unknown;
  mutation?: boolean;
}

export interface CapturedMutation {
  calls: unknown[];
  lastOptions: Record<string, unknown>;
  mutationFn: ReturnType<typeof vi.fn<(args: unknown) => Promise<unknown>>>;
}

function toDotted(path: string[]): string {
  return path.join(".");
}

// Matches @trpc/tanstack-react-query input-omitted key: [[...splitPath]].
function toQueryKey(path: string[]): [[...string[]]] {
  return [[...path]];
}

function ensureLeaf(
  root: Record<string, unknown>,
  path: string[],
): Record<string, unknown> {
  let node = root;
  for (const segment of path) {
    if (!(segment in node)) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  return node;
}

export function createMockTRPC(descriptors: ProcedureDescriptor[]): {
  proxy: TRPCProxy;
  captured: Record<string, CapturedMutation>;
} {
  const captured: Record<string, CapturedMutation> = {};

  const root: Record<string, unknown> = {};

  for (const descriptor of descriptors) {
    const { path, query, queryByInput, mutation } = descriptor;
    const dotted = toDotted(path);
    const qk = toQueryKey(path);

    if (query !== undefined && queryByInput !== undefined) {
      throw new Error(
        `Procedure "${dotted}" cannot define both query and queryByInput.`,
      );
    }

    const leaf = ensureLeaf(root, path);

    leaf.pathFilter = () => ({ queryKey: qk });
    leaf.queryKey = () => qk;
    leaf.infiniteQueryKey = (input: unknown) => infiniteQueryKey(qk, input);
    leaf.infiniteQueryFilter = (
      input: unknown,
      filters: Record<string, unknown> = {},
    ) => ({ ...filters, queryKey: infiniteQueryKey(qk, input) });

    if (query !== undefined) {
      buildQuery(leaf, qk, query);
    } else if (queryByInput !== undefined) {
      buildQueryByInput(leaf, path, queryByInput);
    }

    if (mutation) {
      buildMutation(leaf, dotted, captured);
    }
  }

  return {
    proxy: root as unknown as TRPCProxy,
    captured,
  };
}

// Input appended to the TanStack key so distinct inputs get independent cache entries.
function buildQueryByInput(
  leaf: Record<string, unknown>,
  path: string[],
  queryFnFactory: (input: unknown) => unknown,
): void {
  leaf.queryOptions = (input: unknown) => ({
    queryKey: [[...path], input],
    queryFn: () => Promise.resolve(queryFnFactory(input)),
  });
}

// "pending" never settles (loading-state fixtures); a factory is called per
// fetch so a stub can vary between calls; anything else resolves as-is.
function isQueryFactory(value: unknown): value is () => unknown {
  return typeof value === "function";
}

function resolveQueryFn(query: unknown): () => Promise<unknown> {
  if (query === "pending") return () => new Promise<never>(() => undefined);
  if (isQueryFactory(query)) {
    return () => Promise.resolve(query());
  }
  return () => Promise.resolve(query);
}

function buildQuery(
  leaf: Record<string, unknown>,
  qk: [[...string[]]],
  query: unknown,
): void {
  const queryFn = resolveQueryFn(query);
  leaf.queryOptions = () => ({ queryKey: qk, queryFn });
  // Cursor-paginated procedures receive cursor and direction from tRPC's
  // infinite-query context; the stub factory sees that actual server input.
  leaf.infiniteQueryOptions = (
    input: unknown,
    opts: {
      readonly initialPageParam?: unknown;
      readonly getNextPageParam?: (lastPage: unknown) => unknown;
    } = {},
  ) => ({
    queryKey: infiniteQueryKey(qk, input),
    queryFn: ({
      pageParam,
      direction = "forward",
    }: {
      pageParam: unknown;
      direction?: "forward" | "backward";
    }) => {
      if (query === "pending") return new Promise<never>(() => undefined);
      const merged = {
        ...(input as Record<string, unknown>),
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
        direction,
      };
      return typeof query === "function"
        ? Promise.resolve((query as (i: unknown) => unknown)(merged))
        : Promise.resolve(query);
    },
    // Mirrors tRPC: the first page param defaults to the input's own `cursor`
    // (undefined here), not a forced null.
    initialPageParam:
      opts.initialPageParam ?? (input as Record<string, unknown>).cursor,
    getNextPageParam: opts.getNextPageParam,
  });
}

function infiniteQueryKey(
  qk: [[...string[]]],
  input: unknown,
): readonly unknown[] {
  if (input === undefined) return [...qk, { type: "infinite" }];
  const keyInput = Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(
      ([key]) => key !== "cursor" && key !== "direction",
    ),
  );
  return [...qk, { input: keyInput, type: "infinite" }];
}

function buildMutation(
  leaf: Record<string, unknown>,
  dotted: string,
  captured: Record<string, CapturedMutation>,
): void {
  const mutationFn = vi.fn();
  const entry: CapturedMutation = {
    calls: [],
    lastOptions: {},
    mutationFn,
  };
  captured[dotted] = entry;

  leaf.mutationOptions = (opts: Record<string, unknown>) => {
    entry.lastOptions = opts;
    return {
      ...opts,
      mutationFn: (...args: unknown[]): Promise<unknown> => {
        entry.calls.push(args[0]);
        return Promise.resolve(mutationFn(...args) as unknown);
      },
    };
  };
}
