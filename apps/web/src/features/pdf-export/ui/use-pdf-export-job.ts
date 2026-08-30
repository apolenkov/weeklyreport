import { MS_PER_SECOND, type PeriodStatus } from "@customreport/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

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
  return status === "completed" || status === "failed"
    ? false
    : STATUS_POLL_INTERVAL_MS;
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
  readonly handleExport: () => void;
}

export function usePdfExportJob({
  reportId,
  periodStatus,
}: UsePdfExportJobArgs): UsePdfExportJobResult {
  const trpc = useTRPC();
  const [activeJob, setActiveJob] = useReducer(
    (_current: ActivePdfExportJob | null, next: ActivePdfExportJob | null) =>
      next,
    null,
  );
  const jobId = activeJob?.reportId === reportId ? activeJob.jobId : null;
  // Held so the fallback link stays visible after jobId is cleared.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  // One-shot guard: delivery fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);
  const requestMut = useMutation(trpc.pdfExport.request.mutationOptions());

  const statusQ = useJobStatusPoll(jobId);

  useEffect(() => {
    const storedJobId = readStoredActiveJob(reportId);
    setActiveJob(
      storedJobId === null ? null : { reportId, jobId: storedJobId },
    );
  }, [reportId]);

  useEffect(() => {
    if (jobId === null) return;
    const outcome = readJobOutcome(statusQ.isError, statusQ.data);
    if (outcome === null) return;

    if (outcome.kind === "failed") {
      toast.error(outcome.message);
      removeStoredActiveJob(reportId);
      setActiveJob(null);
      return;
    }

    if (lastDownloadedJobIdRef.current === outcome.jobId) return;
    lastDownloadedJobIdRef.current = outcome.jobId;
    deliverArtifact(outcome.artifactUrl, setFallbackUrl);
    removeStoredActiveJob(reportId);
    setActiveJob(null);
  }, [statusQ.data, statusQ.isError, jobId, reportId]);

  const isExportable = periodStatus === "published";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;

  function handleExport() {
    if (disabled) return;
    setFallbackUrl(null);
    requestMut.mutate(
      { reportId },
      exportRequestHandlers((nextJobId) => {
        storeActiveJob(reportId, nextJobId);
        setActiveJob({ reportId, jobId: nextJobId });
      }),
    );
  }

  return { isExportable, isGenerating, disabled, fallbackUrl, handleExport };
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
  | {
      readonly kind: "completed";
      readonly jobId: string;
      readonly artifactUrl: string;
    };

// null means "keep polling": no status yet, or the job is still queued.
function readJobOutcome(
  isError: boolean,
  data: JobStatusData | undefined,
): JobOutcome | null {
  if (isError) {
    return {
      kind: "failed",
      message: "PDF export status check failed. Please try again.",
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
