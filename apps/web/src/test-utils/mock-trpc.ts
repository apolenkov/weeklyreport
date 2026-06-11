/**
 * Shared tRPC mock factory for web component and hook tests.
 *
 * Each procedure is declared once as a path descriptor; `queryOptions()`,
 * `queryKey()`, and `pathFilter()` all derive from that single path so the
 * shapes can never diverge. This pins the fix for the vacuous `{ tag }` filter
 * bug (see proposal.md) — `pathFilter()` now always returns
 * `{ queryKey: [splitPath] }`.
 *
 * @internal — test utility only; not imported by production code.
 */

import { vi } from "vitest";

import type { TRPCProxy } from "../lib/trpc";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/** Data variant for a query descriptor. */
type QueryData = unknown | (() => unknown);

export interface ProcedureDescriptor {
  /** e.g. ["admin", "jobs", "listFailed"] */
  path: string[];
  /**
   * Query stub. Accepts:
   *  - a value — returned from queryFn wrapped in Promise.resolve
   *  - a () => value factory — called each time queryFn runs
   *  - "pending" — queryFn never resolves (keeps isPending true)
   */
  query?: QueryData | "pending";
  /** If true, registers a capturing mutation at this path. */
  mutation?: boolean;
}

export interface CapturedMutation {
  /** mutationFn inputs, in order */
  calls: unknown[];
  /** last caller-passed options object (onSuccess/onError/etc.) */
  lastOptions: Record<string, unknown>;
  /** the vi.fn() used as mutationFn */
  mutationFn: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Converts a path array to a dotted string key for the `captured` map. */
function toDotted(path: string[]): string {
  return path.join(".");
}

/**
 * Key shape that mirrors @trpc/tanstack-react-query@11 getQueryKeyInternal:
 * the "input-omitted" form is [[...splitPath]].
 */
function toQueryKey(path: string[]): [[...string[]]] {
  return [[...path]];
}

/** Walks `root`, creating intermediate objects as needed, and returns the leaf. */
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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal tRPC proxy stub from path descriptors.
 *
 * @returns
 *  - `proxy` — the typed proxy stub; pass to TRPCProxyContext.Provider
 *  - `captured` — mutation-capture registry keyed by dotted path
 */
export function createMockTRPC(descriptors: ProcedureDescriptor[]): {
  proxy: TRPCProxy;
  captured: Record<string, CapturedMutation>;
} {
  const captured: Record<string, CapturedMutation> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional: building a deep dynamic object that maps to TRPCProxy; the single cast is at the return site
  const root: Record<string, any> = {};

  for (const descriptor of descriptors) {
    const { path, query, mutation } = descriptor;
    const dotted = toDotted(path);
    const qk = toQueryKey(path);

    const leaf = ensureLeaf(root, path);

    // pathFilter and bare queryKey() always derive from the same path.
    leaf.pathFilter = () => ({ queryKey: qk });
    leaf.queryKey = () => qk;

    if (query !== undefined) {
      buildQuery(leaf, qk, query);
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

// ---------------------------------------------------------------------------
// Internal builders (extracted to keep createMockTRPC under complexity limit)
// ---------------------------------------------------------------------------

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
