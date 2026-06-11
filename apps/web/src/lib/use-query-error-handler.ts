"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { ClientErrorContext } from "./client-error-reporting";
import {
  formatClientErrorMessage,
  logClientError,
} from "./client-error-reporting";

interface QueryErrorState {
  isError: boolean;
  error: unknown;
}

interface UseQueryErrorHandlerOpts {
  /** logClientError event label, e.g. "leadForm.byPeriod.load_failed" */
  event: string;
  /** Component name for log context, e.g. "LeadForm" */
  component: string;
  /** tRPC procedure path for log context, e.g. "leadForm.byPeriod" */
  procedure: string;
  /** Extra log fields (reportId, role, …). Read via ref — changes during a
   *  persistent error do NOT re-fire the effect (design.md D2). */
  context?: ClientErrorContext;
  /** When set, calls toast.error with formatClientErrorMessage output.
   *  Omit to stay log-only (slides policy, design.md D3). */
  toastPrefix?: string;
}

/**
 * Single error-policy seam for TanStack Query load failures (design.md D1/D2).
 *
 * On each `isError` → `true` transition:
 *   1. Logs via `logClientError(event, error, { component, procedure, …context })`.
 *   2. Iff `toastPrefix` is set: toasts via
 *      `toast.error(formatClientErrorMessage(toastPrefix, error))`.
 *
 * Effect deps are exactly `[query.isError, query.error]`. `opts` is read
 * through a ref so context value changes during a persistent error do not
 * re-fire (design.md D2, pinned by hook test case (e)).
 */
export function useQueryErrorHandler(
  query: QueryErrorState,
  opts: UseQueryErrorHandlerOpts,
): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!query.isError) return;

    const { event, component, procedure, context, toastPrefix } =
      optsRef.current;

    logClientError(event, query.error, { component, procedure, ...context });

    if (toastPrefix !== undefined) {
      toast.error(formatClientErrorMessage(toastPrefix, query.error));
    }
  }, [query.isError, query.error]); // opts read via ref — stable, intentionally excluded
}
