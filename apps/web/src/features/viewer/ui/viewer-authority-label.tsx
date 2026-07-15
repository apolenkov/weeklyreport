import type { PeriodStatus } from "@customreport/shared";

const WORKING_REPORT_BANNER = "Working report — includes drafts";

export interface ViewerAuthority {
  readonly stateLabel: "Draft" | "Reopened" | "Published";
  readonly workingBanner: typeof WORKING_REPORT_BANNER | null;
}

const VIEWER_AUTHORITY_BY_STATUS = {
  open: {
    stateLabel: "Draft",
    workingBanner: WORKING_REPORT_BANNER,
  },
  reopened: {
    stateLabel: "Reopened",
    workingBanner: WORKING_REPORT_BANNER,
  },
  published: {
    stateLabel: "Published",
    workingBanner: null,
  },
} as const satisfies Readonly<Record<PeriodStatus, ViewerAuthority>>;

export function deriveViewerAuthority(
  periodStatus: PeriodStatus,
): ViewerAuthority {
  return VIEWER_AUTHORITY_BY_STATUS[periodStatus];
}

export function ViewerAuthorityLabel({
  authority,
}: {
  readonly authority: ViewerAuthority;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {authority.workingBanner ? (
        <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {authority.workingBanner}
        </span>
      ) : null}
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
        {authority.stateLabel}
      </span>
    </div>
  );
}
