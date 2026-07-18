"use client";

import { MS_PER_SECOND, type PeriodStatus } from "@customreport/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";

const STATUS_POLL_INTERVAL_MS = 2 * MS_PER_SECOND;

type DeliveryMode = "tab" | "fallback";

interface ExportPdfButtonProps {
  readonly reportId: string;
  readonly periodStatus: PeriodStatus;
}

/**
 * Export PDF button.
 *
 * Wires the leadership-scoped (head/admin/viewer; lead FORBIDDEN)
 * `pdfExport.request` mutation to start a BullMQ job, then
 * polls `pdfExport.status` every 2 seconds until the worker reports
 * `completed` or `failed`. Opens a blank tab synchronously on click so the
 * later navigation is not treated as an unsolicited popup; if open is blocked,
 * renders a download link once the artifact URL is known.
 *
 * The button is disabled only for never-published open periods. Reopened
 * periods are still backed by a published report row and can be exported.
 */
export function ExportPdfButton({
  reportId,
  periodStatus,
}: ExportPdfButtonProps) {
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
  const disabledReasonId = `${reportId}-export-pdf-disabled-reason`;

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

  // Rendered through the shared 32px ToolbarIconButton so the
  // head/lead toolbars share one icon-action vocabulary. Per the icon-button
  // primitive the tooltip stays equivalent to the aria-label ("Export PDF"); the
  // unpublished precondition moves to an aria-describedby/sr-only hint, never the
  // tooltip. The async contract (request → poll → busy → download → toast) above
  // is unchanged — only the presentation differs.
  const buttonClassName = isGenerating
    ? "border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-white disabled:opacity-100"
    : "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40";

  return (
    <>
      <ToolbarIconButton
        aria-label="Export PDF"
        onClick={handleExport}
        disabled={disabled}
        aria-busy={isGenerating}
        aria-describedby={!isExportable ? disabledReasonId : undefined}
        className={buttonClassName}
      >
        {isGenerating ? <ExportSpinnerIcon /> : <ExportPdfIcon />}
      </ToolbarIconButton>
      {!isExportable ? (
        <span id={disabledReasonId} className="sr-only">
          Publish the report first to export PDF.
        </span>
      ) : null}
      {fallbackUrl !== null ? (
        <a href={fallbackUrl} download>
          Download PDF
        </a>
      ) : null}
    </>
  );
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

// ---------------------------------------------------------------------------
// Internal icons (14×14, centred in the 32px circle — matches SaveNowButton).
// ---------------------------------------------------------------------------

function ExportPdfIcon() {
  return (
    <svg
      data-testid="export-pdf-icon"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExportSpinnerIcon() {
  return (
    <svg
      data-testid="export-pdf-spinner"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      style={{ animation: "exportBtnSpin 1s linear infinite" }}
    >
      <style>{`@keyframes exportBtnSpin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 11"
        opacity="0.9"
      />
    </svg>
  );
}
