import type { AppRouter } from "@customreport/api/infrastructure/trpc/trpc.router";
import type { QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient as createTRPCClientCore,
  httpBatchLink,
  splitLink,
  TRPCClientError,
  type TRPCLink,
} from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { fetchWithTraceparent } from "./trace-context";

// ---------------------------------------------------------------------------
// 401 interceptor — redirect logic
// ---------------------------------------------------------------------------

/**
 * Pages where a 401 must NOT trigger a redirect (would cause loops).
 *   /            login page
 *   /auth/*      SAML callback + error pages
 */
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

/**
 * Pure function exported for unit testing. Given an unknown error captured
 * by the tRPC link, returns true if a redirect was issued, false otherwise.
 *
 * Skips when:
 *   - running on the server (no `window`),
 *   - the error is not a TRPCClientError,
 *   - the error's HTTP status is not 401,
 *   - the current path matches AUTH_REDIRECT_EXEMPT.
 *
 * Redirect target: '/' (the login page in this app — there is no /login
 * route). The original path + search is appended as ?next=<encoded>.
 */
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

/**
 * Custom tRPC link that runs BEFORE httpBatchLink. It observes errors
 * flowing back from the network and triggers a redirect on 401, then
 * swallows the error (so downstream callers don't also fire toast/throw
 * during the in-flight navigation).
 *
 * @internal — exported for unit tests; production wiring stays via makeTRPCClient
 */
export function createAuthRedirectLink(): TRPCLink<AppRouter> {
  const handle = createAuthRedirectHandler();
  return () =>
    ({ next, op }) =>
      observable((observer) => {
        const subscription = next(op).subscribe({
          next: (value) => observer.next(value),
          error: (err) => {
            if (handle(err)) {
              // Redirect is in flight — do not propagate the error.
              return;
            }
            observer.error(err);
          },
          complete: () => observer.complete(),
        });
        return () => subscription.unsubscribe();
      });
}

/**
 * True when an error is a tRPC CONFLICT (HTTP 409) — the optimistic-lock
 * rejection a stale section write produces. Callers use it to react to a
 * lost-update (refetch + surface) rather than treating it as a generic error.
 */
export function isConflictError(err: unknown): boolean {
  if (!(err instanceof TRPCClientError)) return false;
  const data = err.data as { httpStatus?: number; code?: string } | undefined;
  return data?.code === "CONFLICT" || data?.httpStatus === HTTP_CONFLICT;
}

// ---------------------------------------------------------------------------
// Client + proxy factories
// ---------------------------------------------------------------------------

export function makeTRPCClient() {
  const transportOptions = {
    transformer: superjson,
    url: "/trpc",
    fetch: fetchWithTraceparent,
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
