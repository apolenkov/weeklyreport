import { RotatingChevron } from "../../../shared/ui/report-shell/rotating-chevron";
import type { WeeklyProductReport } from "../../report-sections";
import {
  CSS,
  HEADER_STATUS_TONE,
  STATUS_CONFIG,
  type StatusConfig,
} from "./accordion-tokens";

const EMPTY_CONFIG: StatusConfig = {
  bg: CSS.muted,
  text: CSS.mutedForeground,
  avatarBg: CSS.muted,
  avatarText: CSS.mutedForeground,
};

function HeaderIdentity({
  report,
  config,
  statusLabel,
  statusTone,
}: {
  readonly report: WeeklyProductReport;
  readonly config: StatusConfig;
  readonly statusLabel: string;
  readonly statusTone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ background: config.avatarBg, color: config.avatarText }}
      >
        {report.initials}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.015em]">
            {report.name}
          </span>
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
            style={{ color: statusTone }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: statusTone }}
              aria-hidden="true"
            />
            {statusLabel}
          </span>
        </div>
        <span className="truncate text-[12.5px] text-[var(--color-muted-foreground)]">
          {report.leads}
        </span>
      </div>
    </div>
  );
}

/**
 * Accordion Header.
 * @param options - The options argument.
 */
export function AccordionHeader({
  report,
  hasContent,
  expanded,
  onToggle,
}: {
  readonly report: WeeklyProductReport;
  readonly hasContent: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const config = hasContent ? STATUS_CONFIG[report.status] : EMPTY_CONFIG;
  const statusLabel = hasContent ? report.statusLabel : "No updates";
  const statusTone = hasContent
    ? HEADER_STATUS_TONE[report.status]
    : CSS.mutedForeground;
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 p-4 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
        hasContent
          ? "cursor-pointer hover:bg-[var(--color-surface-muted)]"
          : "cursor-default bg-[var(--color-background)] opacity-65"
      }`}
      onClick={onToggle}
      disabled={!hasContent}
      aria-disabled={!hasContent}
      aria-expanded={hasContent ? expanded : false}
      data-product-accordion-toggle="true"
    >
      <HeaderIdentity
        report={report}
        config={config}
        statusLabel={statusLabel}
        statusTone={statusTone}
      />
      {hasContent ? (
        <RotatingChevron expanded={expanded} />
      ) : (
        <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
