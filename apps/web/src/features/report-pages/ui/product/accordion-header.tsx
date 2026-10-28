import { RotatingChevron } from "../../../../shared/ui/report-shell/rotating-chevron";
import type { WeeklyProductReport } from "../../../report-sections";
import {
  CSS,
  HEADER_STATUS_DOT,
  HEADER_STATUS_TONE,
  STATUS_CONFIG,
  type StatusConfig,
} from "./accordion-tokens";

const EMPTY_CONFIG: StatusConfig = {
  avatarBg: CSS.muted,
  avatarText: CSS.mutedForeground,
};

function HeaderIdentity({
  report,
  config,
  statusLabel,
  statusTone,
  statusDot,
}: {
  readonly report: WeeklyProductReport;
  readonly config: StatusConfig;
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly statusDot: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 pr-3">
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: config.avatarBg, color: config.avatarText }}
      >
        {report.initials}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5">
          <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.015em] [overflow-wrap:anywhere]">
            {report.name}
          </span>
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold"
            style={{ color: statusTone }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: statusDot }}
              aria-hidden="true"
            />
            {statusLabel}
          </span>
        </span>
        <span className="text-[12.5px] text-[var(--color-muted-foreground)] [overflow-wrap:anywhere]">
          {report.leads}
        </span>
      </span>
    </span>
  );
}

export function AccordionHeader({
  report,
  hasContent,
  expanded,
  onToggle,
  toggleId,
  panelId,
}: {
  readonly report: WeeklyProductReport;
  readonly hasContent: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly toggleId: string;
  readonly panelId: string;
}) {
  const config = hasContent ? STATUS_CONFIG[report.status] : EMPTY_CONFIG;
  const statusLabel = hasContent ? report.statusLabel : "No updates";
  const statusTone = hasContent
    ? HEADER_STATUS_TONE[report.status]
    : CSS.mutedForeground;
  const statusDot = hasContent
    ? HEADER_STATUS_DOT[report.status]
    : CSS.mutedForeground;
  return (
    <button
      type="button"
      id={hasContent ? toggleId : undefined}
      className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-[background-color,border-color,box-shadow] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
        hasContent
          ? "cursor-pointer hover:bg-[var(--color-surface-muted)]"
          : "cursor-default bg-[var(--color-background)]"
      }`}
      onClick={onToggle}
      disabled={!hasContent}
      aria-disabled={!hasContent}
      aria-expanded={hasContent ? expanded : undefined}
      aria-controls={hasContent ? panelId : undefined}
      data-product-accordion-toggle="true"
    >
      <HeaderIdentity
        report={report}
        config={config}
        statusLabel={statusLabel}
        statusTone={statusTone}
        statusDot={statusDot}
      />
      {hasContent ? (
        <RotatingChevron expanded={expanded} />
      ) : (
        <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
