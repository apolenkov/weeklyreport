"use client";

import type { PeriodStatus } from "@customreport/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";

import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { usePdfExportJob } from "./use-pdf-export-job";

const DISABLED_REASON = "Publish or re-publish the report to export PDF.";
const DISABLED_TRIGGER_CLASS =
  "inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1";
const FALLBACK_LINK_CLASS =
  "inline-flex min-h-8 max-md:min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-[var(--color-starbucks-accent)] underline-offset-4 hover:bg-[var(--color-success)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1";

interface ExportPdfButtonProps {
  readonly reportId: string;
  readonly periodStatus: PeriodStatus;
}

function exportButtonClassName(isGenerating: boolean): string {
  return isGenerating
    ? "border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)] disabled:opacity-100"
    : "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40";
}

function ExportActionButton({
  disabled,
  isGenerating,
  onExport,
  className,
  describedBy,
}: {
  readonly disabled: boolean;
  readonly isGenerating: boolean;
  readonly onExport: () => void;
  readonly className: string;
  readonly describedBy?: string | undefined;
}) {
  return (
    <ToolbarIconButton
      aria-label="Export PDF"
      onClick={onExport}
      disabled={disabled}
      aria-busy={isGenerating}
      aria-describedby={describedBy}
      className={className}
    >
      {isGenerating ? <ExportSpinnerIcon /> : <ExportPdfIcon />}
    </ToolbarIconButton>
  );
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

  const buttonClassName = exportButtonClassName(isGenerating);

  return (
    <>
      {!isExportable ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid="export-pdf-disabled-trigger"
                role="group"
                aria-label="Export PDF unavailable"
                aria-describedby={disabledReasonId}
                tabIndex={0}
                className={DISABLED_TRIGGER_CLASS}
              >
                <ExportActionButton
                  disabled={disabled}
                  isGenerating={isGenerating}
                  onExport={handleExport}
                  className={buttonClassName}
                  describedBy={disabledReasonId}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={6}>
              {DISABLED_REASON}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <ExportActionButton
          disabled={disabled}
          isGenerating={isGenerating}
          onExport={handleExport}
          className={buttonClassName}
        />
      )}
      {!isExportable ? (
        <span id={disabledReasonId} className="sr-only">
          {DISABLED_REASON}
        </span>
      ) : null}
      {fallbackUrl !== null ? (
        <a href={fallbackUrl} download className={FALLBACK_LINK_CLASS}>
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
      className="animate-spin motion-reduce:animate-none"
    >
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
