import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useRef, useState } from "react";

interface RequiredRead {
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  readonly refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>;
}

export type LeadFormRequiredReadState =
  | { readonly status: "loading" | "ready" | "no-active" | "unavailable" }
  | {
      readonly status: "error";
      readonly isRetrying: boolean;
      readonly retry: () => Promise<unknown>;
    };

interface RetryAttempt {
  readonly scope: string | null;
  readonly supporting: boolean;
}

function missingSectionNeedsRecovery(
  failedReads: readonly RequiredRead[],
  attempt: RetryAttempt | null,
): boolean {
  return failedReads.length > 0 || attempt?.supporting === true;
}

export function useLeadFormRequiredReads({
  scope,
  enabled,
  activeData,
  sectionUnavailable,
  active,
  section,
  history,
}: {
  readonly scope: string | null;
  readonly enabled: boolean;
  readonly activeData: ReportSectionReadModel | null | undefined;
  readonly sectionUnavailable: boolean;
  readonly active: RequiredRead;
  readonly section: RequiredRead;
  readonly history: RequiredRead;
}): LeadFormRequiredReadState {
  const [retryAttempt, setRetryAttempt] = useState<RetryAttempt | null>(null);
  const inFlight = useRef<{
    readonly attempt: RetryAttempt;
    readonly promise: Promise<unknown>;
  } | null>(null);
  const retrying = retryAttempt !== null && retryAttempt.scope === scope;
  const failedReads = (
    sectionUnavailable ? [active, history] : [active, section, history]
  ).filter((query) => query.isError);
  const retry = () => {
    if (inFlight.current?.attempt.scope === scope)
      return inFlight.current.promise;
    const attempt = { scope, supporting: sectionUnavailable };
    setRetryAttempt(attempt);
    const promise = Promise.all(
      failedReads.map((query) => query.refetch({ cancelRefetch: false })),
    ).finally(() => {
      if (inFlight.current?.attempt === attempt) inFlight.current = null;
      setRetryAttempt((current) => (current === attempt ? null : current));
    });
    inFlight.current = { attempt, promise };
    return promise;
  };

  if (!enabled) return { status: "loading" };
  if (
    sectionUnavailable &&
    !missingSectionNeedsRecovery(failedReads, retrying ? retryAttempt : null)
  )
    return { status: "unavailable" };
  if (
    active.isError ||
    retrying ||
    sectionUnavailable ||
    (activeData !== null && failedReads.length > 0)
  ) {
    return {
      status: "error",
      isRetrying: retrying || failedReads.some((query) => query.isFetching),
      retry,
    };
  }
  if (activeData === null) return { status: "no-active" };
  if ([active, section, history].some((query) => query.isPending)) {
    return { status: "loading" };
  }
  return { status: "ready" };
}
