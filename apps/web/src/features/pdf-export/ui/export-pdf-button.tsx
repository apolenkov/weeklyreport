"use client";

import type { PeriodStatus } from "@customreport/shared";

import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { usePdfExportJob } from "./use-pdf-export-job";

interface ExportPdfButtonProps {
  readonly reportId: string;
  readonly periodStatus: PeriodStatus;
}

// Disabled while editable (incl. reopen): backend exports only the
// published read model.
export function ExportPdfButton({
  reportId,
  periodStatus,
}: ExportPdfButtonProps) {
  const { isExportable, isGenerating, disabled, fallbackUrl, handleExport } =
    usePdfExportJob({ reportId, periodStatus });
  const disabledReasonId = `${reportId}-export-pdf-disabled-reason`;

  // Unpublished reason goes on aria-describedby/sr-only — disabled controls
  // cannot reveal a tooltip on hover/focus.
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
          Publish or re-publish the report to export PDF.
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

// 14×14 icons, centred in the 32px ToolbarIconButton circle (matches SaveNowButton).
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
