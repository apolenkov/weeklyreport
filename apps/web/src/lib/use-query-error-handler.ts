"use client";

import { useEffect, useEffectEvent } from "react";
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
  event: string;
  component: string;
  procedure: string;
  // Read via ref so context changes during a persistent error do not re-fire.
  context?: ClientErrorContext;
  // When set, toast; omit for log-only (slides policy).
  toastPrefix?: string;
}

// Single seam for query load failures: log always; toast only when toastPrefix is set.
// opts is read through an effect event so context value changes do not re-fire the effect.
export function useQueryErrorHandler(
  query: QueryErrorState,
  opts: UseQueryErrorHandlerOpts,
): void {
  const readOpts = useEffectEvent(() => opts);

  useEffect(() => {
    if (!query.isError) return;

    const { event, component, procedure, context, toastPrefix } = readOpts();

    logClientError(event, query.error, { component, procedure, ...context });

    if (toastPrefix !== undefined) {
      toast.error(formatClientErrorMessage(toastPrefix, query.error));
    }
  }, [query.isError, query.error]); // opts via effect event — intentionally excluded from deps
}
