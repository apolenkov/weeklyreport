import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  QUEUE_ACTION_CELL_CLASS,
  QUEUE_ACTIONS_CLASS,
  QUEUE_META_CLASS,
  QUEUE_ROW_GRID_CLASS,
} from "./lead-row-format";

const PANEL_HEIGHT_CLASS = {
  kpi: "h-24",
  alert: "h-12",
  blocked: "h-40",
} as const;

// "leads" renders structured skeleton rows instead of a fixed-height block.
export type DashboardPanelKind = keyof typeof PANEL_HEIGHT_CLASS | "leads";

const QUEUE_SKELETON_ROW_KEYS = ["r1", "r2", "r3", "r4"] as const;

// Reserves the loaded queue's row and action-track geometry instead of a
// monolithic block (dashboard-interaction-stability).
function LeadsQueueSkeleton() {
  return (
    <ul className="grid min-w-0 gap-2" aria-hidden="true">
      {QUEUE_SKELETON_ROW_KEYS.map((key) => (
        <li
          key={key}
          className="min-w-0 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]"
        >
          <div className={QUEUE_ROW_GRID_CLASS}>
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-6 w-20 justify-self-end lg:justify-self-start" />
            <div className={QUEUE_META_CLASS}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className={QUEUE_ACTIONS_CLASS}>
              <div className={QUEUE_ACTION_CELL_CLASS}>
                <Skeleton className="h-[var(--dashboard-action-h)] w-full" />
              </div>
              <div className={QUEUE_ACTION_CELL_CLASS}>
                <Skeleton className="h-[var(--dashboard-action-h)] w-full" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPanelLoading({
  kind,
}: {
  readonly kind: DashboardPanelKind;
}) {
  return (
    <div
      data-testid={`dashboard-${kind}-loading`}
      role="status"
      aria-label={`Loading ${kind} data`}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      {kind === "leads" ? (
        <LeadsQueueSkeleton />
      ) : (
        <Skeleton className={`w-full ${PANEL_HEIGHT_CLASS[kind]}`} />
      )}
    </div>
  );
}

interface DashboardPanelIssueProps {
  readonly kind: DashboardPanelKind;
  readonly testId?: string;
  readonly title: string;
  readonly description: string;
  readonly onRetry: () => void;
}

export function DashboardPanelIssue({
  kind,
  testId,
  title,
  description,
  onRetry,
}: DashboardPanelIssueProps) {
  return (
    <section
      data-testid={testId ?? `dashboard-${kind}-error`}
      className="flex min-h-24 flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 text-[var(--color-warning)]"
        />
        <div>
          <h2 className="font-semibold text-[var(--color-foreground)]">
            {title}
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Retry
      </button>
    </section>
  );
}
