import { useMutation, useQuery } from "@tanstack/react-query";
import { MS_PER_SECOND, type PeriodStatus } from "@weeklyreport/shared";
import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import {
  formatClientErrorMessage,
  getClientErrorDetails,
} from "../../../shared/lib/errors/client-error-reporting";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

const STATUS_POLL_INTERVAL_MS = 2 * MS_PER_SECOND;
const ACTIVE_JOB_STORAGE_PREFIX = "weeklyreport:pdf-export:active";

interface ActivePdfExportJob {
  readonly reportId: string;
  readonly jobId: string;
}

function activeJobStorageKey(reportId: string): string {
  return `${ACTIVE_JOB_STORAGE_PREFIX}:${reportId}`;
}

function readStoredActiveJob(reportId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(activeJobStorageKey(reportId));
  } catch {
    return null;
  }
}

function storeActiveJob(reportId: string, jobId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(activeJobStorageKey(reportId), jobId);
  } catch {
    // The live export still works when tab-scoped storage is unavailable.
  }
}

function removeStoredActiveJob(reportId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(activeJobStorageKey(reportId));
  } catch {
    // Storage denial must not block terminal UI recovery.
  }
}

export function pdfExportRefetchInterval(
  status: string | undefined,
): number | false {
  return status === "completed" ||
    status === "failed" ||
    status === "recovery_required"
    ? false
    : STATUS_POLL_INTERVAL_MS;
}

const replaceState = <T>(_current: T | null, next: T | null): T | null => next;

interface FallbackLink {
  readonly reportId: string;
  readonly url: string;
}

interface UsePdfExportJobArgs {
  readonly reportId: string;
  readonly periodStatus: PeriodStatus;
}

interface UsePdfExportJobResult {
  readonly isExportable: boolean;
  readonly isGenerating: boolean;
  readonly disabled: boolean;
  readonly fallbackUrl: string | null;
  readonly recoveryRequired: boolean;
  readonly handleExport: () => void;
}

export function usePdfExportJob({
  reportId,
  periodStatus,
}: UsePdfExportJobArgs): UsePdfExportJobResult {
  const trpc = useTRPC();
  const [activeJob, setActiveJob] = useReducer(
    replaceState<ActivePdfExportJob>,
    null,
  );
  const jobId = activeJob?.reportId === reportId ? activeJob.jobId : null;
  // Held so the fallback link stays visible after jobId is cleared; keyed by
  // reportId so a report switch never offers the previous report's artifact.
  const [fallback, setFallback] = useState<FallbackLink | null>(null);
  const fallbackUrl = fallback?.reportId === reportId ? fallback.url : null;
  // Same reportId keying as the fallback link: a report switch hides the
  // quarantine notice instead of leaking it onto another report.
  const [recoveryNotice, setRecoveryNotice] = useReducer(
    replaceState<{ readonly reportId: string }>,
    null,
  );
  const recoveryRequired = recoveryNotice?.reportId === reportId;
  // One-shot guard: delivery fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);
  const requestMut = useMutation(trpc.pdfExport.request.mutationOptions());

  const statusQ = useJobStatusPoll(jobId);
  // Poll failures still flow through the error-policy seam: logged once per
  // error transition, no toast — the busy control is the user signal while a
  // transient failure keeps polling.
  useQueryErrorHandler(statusQ, {
    component: "ExportPdfButton",
    event: "pdfExport.status.load_failed",
    procedure: "pdfExport.status",
  });

  useEffect(() => {
    // A report switch owns a fresh artifact surface: reset the one-shot
    // delivery guard and restore this report's stored job. The fallback link is
    // derived from reportId, so the previous report's link cannot leak.
    lastDownloadedJobIdRef.current = null;
    const storedJobId = readStoredActiveJob(reportId);
    setActiveJob(
      storedJobId === null ? null : { reportId, jobId: storedJobId },
    );
  }, [reportId]);

  useEffect(() => {
    if (jobId === null) return;
    const outcome = readJobOutcome(statusQ.error, statusQ.data);
    if (outcome === null) return;

    if (outcome.kind === "failed") {
      toast.error(outcome.message);
      removeStoredActiveJob(reportId);
      setActiveJob(null);
      return;
    }

    if (outcome.kind === "recovery_required") {
      setRecoveryNotice({ reportId });
      removeStoredActiveJob(reportId);
      setActiveJob(null);
      return;
    }

    if (lastDownloadedJobIdRef.current === outcome.jobId) return;
    lastDownloadedJobIdRef.current = outcome.jobId;
    deliverArtifact(outcome.artifactUrl, (url) =>
      setFallback({ reportId, url }),
    );
    removeStoredActiveJob(reportId);
    setActiveJob(null);
  }, [statusQ.data, statusQ.error, jobId, reportId]);

  const isExportable = periodStatus === "published";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;

  function handleExport() {
    if (disabled) return;
    setRecoveryNotice(null);
    requestMut.mutate(
      { reportId },
      exportRequestHandlers((nextJobId) => {
        setFallback(null);
        storeActiveJob(reportId, nextJobId);
        setActiveJob({ reportId, jobId: nextJobId });
      }),
    );
  }

  return {
    isExportable,
    isGenerating,
    disabled,
    fallbackUrl,
    recoveryRequired,
    handleExport,
  };
}

function exportRequestHandlers(onStarted: (jobId: string) => void) {
  return {
    onSuccess: (job: { jobId: string }) => {
      onStarted(job.jobId);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to start PDF export",
      );
    },
  };
}

// Poll until a terminal result; missing data is still a pending observation.
function useJobStatusPoll(jobId: string | null) {
  const trpc = useTRPC();
  return useQuery(
    trpc.pdfExport.status.queryOptions(
      { jobId: jobId ?? "" },
      {
        enabled: jobId !== null,
        refetchInterval: (q) => pdfExportRefetchInterval(q.state.data?.status),
      },
    ),
  );
}

interface JobStatusData {
  readonly status: string;
  readonly jobId: string;
  readonly artifactUrl?: string | null;
}

type JobOutcome =
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "recovery_required" }
  | {
      readonly kind: "completed";
      readonly jobId: string;
      readonly artifactUrl: string;
    };

// null means "keep polling": no status yet, the job is still queued, or the
// last check hit a transient transport failure — none of those is a terminal
// observation of the durable job. Only an observed terminal status or a
// deterministic client error (a stale stored job reads NOT_FOUND) ends it.
function readJobOutcome(
  error: unknown,
  data: JobStatusData | undefined,
): JobOutcome | null {
  if (error !== null) {
    const errorDetails = getClientErrorDetails(error);
    if (!errorDetails.isDeterministicClientError) {
      return null;
    }
    return {
      kind: "failed",
      message: errorDetails.isInvalidLink
        ? "PDF export status is no longer available. Please try again."
        : formatClientErrorMessage("PDF export status check failed", error),
    };
  }
  if (!data) return null;
  if (data.status === "completed" && data.artifactUrl) {
    return {
      kind: "completed",
      jobId: data.jobId,
      artifactUrl: data.artifactUrl,
    };
  }
  if (data.status === "failed") {
    return { kind: "failed", message: "PDF export failed. Please try again." };
  }
  if (data.status === "recovery_required") {
    return { kind: "recovery_required" };
  }
  return null;
}

function deliverArtifact(
  artifactUrl: string,
  setFallbackUrl: (url: string) => void,
): void {
  const download = document.createElement("a");
  download.href = artifactUrl;
  download.download = "";
  document.body.append(download);
  try {
    download.click();
  } finally {
    download.remove();
  }
  setFallbackUrl(artifactUrl);
  toast.success("PDF ready");
}
