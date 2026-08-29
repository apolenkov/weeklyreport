import { MS_PER_SECOND, type PeriodStatus } from "@customreport/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

const STATUS_POLL_INTERVAL_MS = 2 * MS_PER_SECOND;

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
  const [jobId, setJobId] = useReducer(
    (_current: string | null, next: string | null) => next,
    null,
  );
  // Held so the fallback link stays visible after jobId is cleared.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  // One-shot guard: delivery fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);
  const requestMut = useMutation(trpc.pdfExport.request.mutationOptions());

  const statusQ = useJobStatusPoll(jobId);

  useEffect(() => {
    if (jobId === null) return;
    const outcome = readJobOutcome(statusQ.isError, statusQ.data);
    if (outcome === null) return;

    if (outcome.kind === "failed") {
      toast.error(outcome.message);
      setJobId(null);
      return;
    }

    if (lastDownloadedJobIdRef.current === outcome.jobId) return;
    lastDownloadedJobIdRef.current = outcome.jobId;
    deliverArtifact(outcome.artifactUrl, setFallbackUrl);
    setJobId(null);
  }, [statusQ.data, statusQ.isError, jobId]);

  const isExportable = periodStatus === "published";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;

  function handleExport() {
    if (disabled) return;
    setFallbackUrl(null);
    requestMut.mutate({ reportId }, exportRequestHandlers(setJobId));
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

// Polls only while the job is queued; any terminal status stops the interval.
function useJobStatusPoll(jobId: string | null) {
  const trpc = useTRPC();
  return useQuery(
    trpc.pdfExport.status.queryOptions(
      { jobId: jobId ?? "" },
      {
        enabled: jobId !== null,
        refetchInterval: (q) => {
          const status = q.state.data?.status;
          return status === "queued" ? STATUS_POLL_INTERVAL_MS : false;
        },
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
