"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";
import { ToolbarIconButton } from "../report-shell/toolbar-icon-button";

interface ExportPdfButtonProps {
  readonly reportId: string;
  readonly periodStatus: "open" | "published" | "reopened";
}

/**
 * Export PDF button — Phase 23-01.
 *
 * Wires the leadership-scoped (head/admin/viewer; lead FORBIDDEN)
 * `pdfExport.request` mutation to start a BullMQ job, then
 * polls `pdfExport.status` every 2 seconds until the worker reports
 * `completed` or `failed`. On completion, opens the static `/pdfs/{jobId}.pdf`
 * artefact in a new tab so the browser triggers the download.
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
  // One-shot guard: download fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);

  const requestMut = useMutation(
    trpc.pdfExport.request.mutationOptions({
      onSuccess: (job) => {
        setJobId(job.jobId);
      },
      onError: (err: unknown) => {
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
          return status === "queued" ? 2000 : false;
        },
      },
    ),
  );

  useEffect(() => {
    const data = statusQ.data;
    if (!data || jobId === null) return;

    if (data.status === "completed" && data.artifactUrl) {
      if (lastDownloadedJobIdRef.current !== data.jobId) {
        lastDownloadedJobIdRef.current = data.jobId;
        window.open(data.artifactUrl, "_blank");
        toast.success("PDF ready");
        setJobId(null);
      }
      return;
    }

    if (data.status === "failed") {
      toast.error("PDF export failed. Please try again.");
      setJobId(null);
    }
  }, [statusQ.data, jobId]);

  const isExportable =
    periodStatus === "published" || periodStatus === "reopened";
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isExportable || isGenerating;
  const disabledReasonId = `${reportId}-export-pdf-disabled-reason`;

  function handleExport() {
    if (disabled) return;
    requestMut.mutate({ reportId });
  }

  // toolbar-polish: rendered through the shared 32px ToolbarIconButton so the
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
    </>
  );
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
