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

// Open blank tab on click (user-gesture) so later nav is not a popup; poll
// until completed/failed and fall back to a download link if open is blocked.
/**
 * Use Pdf Export Job.
 * @param props - The props argument.
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
    const outcome = readJobOutcome(statusQ.isError, statusQ.data);
    if (outcome === null) return;

    if (outcome.kind === "failed") {
      closeHeldTab(openedTabRef);
      deliveryModeRef.current = null;
      toast.error(outcome.message);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- polling pipeline reacting to the export job's server status — external-system sync owns this state
      setJobId(null);
      return;
    }

    if (lastDownloadedJobIdRef.current === outcome.jobId) return;
    lastDownloadedJobIdRef.current = outcome.jobId;
    deliverArtifact(
      outcome.artifactUrl,
      deliveryModeRef,
      openedTabRef,
      setFallbackUrl,
    );
    deliveryModeRef.current = null;
    openedTabRef.current = null;
    setJobId(null);
  }, [statusQ.data, statusQ.isError, jobId]);

  const isExportable = periodStatus === "published";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;

  function handleExport() {
    if (disabled) return;
    setFallbackUrl(null);
    openDeliveryTab(deliveryModeRef, openedTabRef);
    requestMut.mutate({ reportId });
  }

  return { isExportable, isGenerating, disabled, fallbackUrl, handleExport };
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
  data:
    { status: string; jobId: string; artifactUrl?: string | null } | undefined,
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

// Must open before any await so the browser still treats this as a user
// gesture; a blocked popup (null) switches delivery to the fallback link.
function openDeliveryTab(
  deliveryModeRef: { current: DeliveryMode | null },
  openedTabRef: { current: Window | null },
): void {
  const tab = window.open("", "_blank");
  deliveryModeRef.current = tab === null ? "fallback" : "tab";
  openedTabRef.current = tab;
}

function closeHeldTab(ref: { current: Window | null }): void {
  const tab = ref.current;
  if (tab !== null && !tab.closed) {
    tab.close();
  }
  ref.current = null;
}

// Prefer the held tab; if closed/blocked, fall back to download link + info
// toast — never claim success for a delivery the user cannot see.
function deliverArtifact(
  artifactUrl: string,
  deliveryModeRef: { current: DeliveryMode | null },
  openedTabRef: { current: Window | null },
  setFallbackUrl: (url: string) => void,
): void {
  const mode = deliveryModeRef.current;
  const tab = openedTabRef.current;
  if (mode === "tab" && tab !== null && !tab.closed) {
    tab.location.href = artifactUrl;
    toast.success("PDF ready");
    return;
  }
  if (mode === "tab" || mode === "fallback") {
    setFallbackUrl(artifactUrl);
    toast.info("PDF ready — use the download link.");
  }
}
