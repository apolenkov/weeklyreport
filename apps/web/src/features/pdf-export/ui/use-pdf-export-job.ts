import { MS_PER_SECOND, type PeriodStatus } from "@customreport/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";

const STATUS_POLL_INTERVAL_MS = 2 * MS_PER_SECOND;

type DeliveryMode = "tab" | "fallback";

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

/**
 * Wires the leadership-scoped (head/admin/viewer; lead FORBIDDEN)
 * `pdfExport.request` mutation to start a BullMQ job, then
 * polls `pdfExport.status` every 2 seconds until the worker reports
 * `completed` or `failed`. Opens a blank tab synchronously on click so the
 * later navigation is not treated as an unsolicited popup; if open is blocked,
 * exposes a fallback URL once the artifact URL is known.
 */
export function usePdfExportJob({
  reportId,
  periodStatus,
}: UsePdfExportJobArgs): UsePdfExportJobResult {
  const trpc = useTRPC();
  const [jobId, setJobId] = useState<string | null>(null);
  // Held so the fallback link stays visible after jobId is cleared.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  // One-shot guard: delivery fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);
  // Set synchronously in the click handler so the poll effect can navigate the
  // same tab (or switch to fallback) without racing React state commits.
  const openedTabRef = useRef<Window | null>(null);
  const deliveryModeRef = useRef<DeliveryMode | null>(null);

  const requestMut = useMutation(
    // eslint-disable-next-line react-hooks/refs -- refs are touched inside mutation callbacks (event time); the options factory just runs during render
    trpc.pdfExport.request.mutationOptions({
      onSuccess: (job) => {
        setJobId(job.jobId);
      },
      onError: (err: unknown) => {
        closeHeldTab(openedTabRef);
        deliveryModeRef.current = null;
        toast.error(
          err instanceof Error ? err.message : "Failed to start PDF export",
        );
      },
    }),
  );

  const statusQ = useQuery(
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

  useEffect(() => {
    if (jobId === null) return;

    if (statusQ.isError) {
      closeHeldTab(openedTabRef);
      deliveryModeRef.current = null;
      toast.error("PDF export status check failed. Please try again.");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- polling pipeline reacting to the export job's server status — external-system sync owns this state
      setJobId(null);
      return;
    }

    const data = statusQ.data;
    if (!data) return;

    if (data.status === "completed" && data.artifactUrl) {
      if (lastDownloadedJobIdRef.current === data.jobId) return;
      lastDownloadedJobIdRef.current = data.jobId;
      deliverArtifact(
        data.artifactUrl,
        deliveryModeRef,
        openedTabRef,
        setFallbackUrl,
      );
      deliveryModeRef.current = null;
      openedTabRef.current = null;
      setJobId(null);
      return;
    }

    if (data.status === "failed") {
      closeHeldTab(openedTabRef);
      deliveryModeRef.current = null;
      toast.error("PDF export failed. Please try again.");
      setJobId(null);
    }
  }, [statusQ.data, statusQ.isError, jobId]);

  const isExportable =
    periodStatus === "published" || periodStatus === "reopened";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;

  function handleExport() {
    if (disabled) return;
    setFallbackUrl(null);
    // Must open before any await so the browser still treats this as a user gesture.
    const tab = window.open("", "_blank");
    if (tab === null) {
      deliveryModeRef.current = "fallback";
      openedTabRef.current = null;
    } else {
      deliveryModeRef.current = "tab";
      openedTabRef.current = tab;
    }
    requestMut.mutate({ reportId });
  }

  return { isExportable, isGenerating, disabled, fallbackUrl, handleExport };
}

function closeHeldTab(ref: { current: Window | null }): void {
  const tab = ref.current;
  if (tab !== null && !tab.closed) {
    tab.close();
  }
  ref.current = null;
}

/**
 * Hands the artifact to the user via the held tab or a fallback URL state.
 * Success toast fires only when one of those paths actually runs.
 */
function deliverArtifact(
  artifactUrl: string,
  deliveryModeRef: { current: DeliveryMode | null },
  openedTabRef: { current: Window | null },
  setFallbackUrl: (url: string) => void,
): void {
  const mode = deliveryModeRef.current;
  if (mode === "tab" && openedTabRef.current !== null) {
    openedTabRef.current.location.href = artifactUrl;
    toast.success("PDF ready");
    return;
  }
  if (mode === "fallback") {
    setFallbackUrl(artifactUrl);
    toast.success("PDF ready");
  }
}
