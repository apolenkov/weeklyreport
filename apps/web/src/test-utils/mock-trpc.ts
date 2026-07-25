// pathFilter/queryKey/queryOptions derive from one path so they cannot diverge.
import { vi } from "vitest";

import type { TRPCProxy } from "../lib/trpc";

type QueryData = unknown | (() => unknown);

export interface ProcedureDescriptor {
  path: string[];
  // value | factory | "pending" (never resolves). Prefer queryByInput for parameterized queries.
  query?: QueryData | "pending";
  // Input-aware stub; input lands in queryKey so distinct inputs cache separately. Incompatible with query.
  queryByInput?: (input: unknown) => unknown;
  mutation?: boolean;
}

export interface CapturedMutation {
  calls: unknown[];
  lastOptions: Record<string, unknown>;
  mutationFn: ReturnType<typeof vi.fn>;
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
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async queryFn contract; no awaitable work in the stub
    queryFn: async () => queryFnFactory(input),
  });
}

function buildQuery(
  leaf: Record<string, unknown>,
  qk: [[...string[]]],
  query: QueryData | "pending",
): void {
  const isPending = query === "pending";

  let queryFn: () => Promise<unknown>;
  if (isPending) {
    queryFn = () => new Promise<never>(() => undefined);
  } else if (typeof query === "function") {
    queryFn = () => Promise.resolve((query as () => unknown)());
  } else {
    queryFn = () => Promise.resolve(query);
  }

  leaf.queryOptions = () => ({ queryKey: qk, queryFn });
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
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the React Query mutationFn contract; no awaitable work in the stub
      mutationFn: async (...args: unknown[]): Promise<unknown> => {
        entry.calls.push(args[0]);
        return mutationFn(...args) as unknown;
      },
    };
  };
}
