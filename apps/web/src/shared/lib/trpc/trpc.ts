import type { AppRouter } from "@customreport/api/infrastructure/trpc/trpc.router";
import type { QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient as createTRPCClientCore,
  httpBatchLink,
  splitLink,
  TRPCClientError,
  type TRPCLink,
} from "@trpc/client";
import {
  type Observable,
  observable,
  type Observer,
} from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { createTraceparent } from "../telemetry/trace-context";

// Pages where a 401 must not redirect (would loop): login and /auth/* callbacks.
const AUTH_REDIRECT_EXEMPT = /^\/(?:$|auth(?:\/|$))/;

const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;

const PROGRESSIVE_DASHBOARD_PROCEDURES = [
  "admin.listReopenRequests",
  "activity.live",
  "review.dashboard",
  "weeklyReport.get",
] as const;

export function isProgressiveDashboardProcedure(path: string): boolean {
  return (PROGRESSIVE_DASHBOARD_PROCEDURES as readonly string[]).includes(path);
}

// Redirect target is '/' (no /login route); original path is ?next=.
export function createAuthRedirectHandler(): (err: unknown) => boolean {
  return (err: unknown): boolean => {
    if (typeof window === "undefined") return false;
    if (!(err instanceof TRPCClientError)) return false;

    const data = err.data as { httpStatus?: number; code?: string } | undefined;
    const httpStatus = data?.httpStatus;
    const code = data?.code;
    const isUnauthorized =
      httpStatus === HTTP_UNAUTHORIZED || code === "UNAUTHORIZED";
    if (!isUnauthorized) return false;

    const { pathname, search } = window.location;
    if (AUTH_REDIRECT_EXEMPT.test(pathname)) return false;

    // Use just pathname+search for assign — keeps the host and scheme
    // implicit (some tests stub window.location and don't include origin).
    window.location.assign(`/?next=${encodeURIComponent(pathname + search)}`);
    return true;
  };
}

function forwardUnlessRedirecting<TValue, TError>(
  source: Observable<TValue, TError>,
  observer: Observer<TValue, TError>,
  handle: (err: unknown) => boolean,
): () => void {
  const subscription = source.subscribe({
    next: (value) => observer.next(value),
    error: (err) => {
      // Redirect is in flight — do not propagate the error.
      if (handle(err)) return;
      observer.error(err);
    },
    complete: () => observer.complete(),
  });
  return () => subscription.unsubscribe();
}

// Runs before httpBatchLink; swallows the error once redirect is in flight
// so callers do not also toast/throw during navigation.
export function createAuthRedirectLink(): TRPCLink<AppRouter> {
  const handle = createAuthRedirectHandler();
  return () =>
    ({ next, op }) =>
      observable((observer) =>
        forwardUnlessRedirecting(next(op), observer, handle),
      );
}

// Optimistic-lock rejection on a stale section write — callers refetch rather than generic-error.
export function isConflictError(err: unknown): boolean {
  if (!(err instanceof TRPCClientError)) return false;
  const data = err.data as { httpStatus?: number; code?: string } | undefined;
  return data?.code === "CONFLICT" || data?.httpStatus === HTTP_CONFLICT;
}

export function makeTRPCClient() {
  const transportOptions = {
    transformer: superjson,
    url: "/trpc",
    headers: () => ({ traceparent: createTraceparent() }),
  } as const;

  return createTRPCClientCore<AppRouter>({
    links: [
      // Auth redirect MUST come before the transport so it can observe the
      // network error stream and short-circuit before the caller sees it.
      createAuthRedirectLink(),
      splitLink({
        condition: ({ path }) => isProgressiveDashboardProcedure(path),
        // A slow dashboard source must not hold ready sibling panels inside
        // one batch response. Keep the batch wire format, but isolate each
        // independently rendered root query at the transport boundary.
        true: httpBatchLink({ ...transportOptions, maxItems: 1 }),
        false: httpBatchLink(transportOptions),
      }),
    ],
  });
}

export function makeTRPCProxy(queryClient: QueryClient) {
  return createTRPCOptionsProxy<AppRouter>({
    client: makeTRPCClient(),
    queryClient,
  });
}

export type TRPCProxy = ReturnType<typeof makeTRPCProxy>;
