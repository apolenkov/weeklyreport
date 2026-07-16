import { Skeleton } from "@customreport/ui/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";

const PANEL_HEIGHT_CLASS = {
  kpi: "h-24",
  leads: "h-56",
  alert: "h-12",
  blocked: "h-40",
} as const;

export type DashboardPanelKind = keyof typeof PANEL_HEIGHT_CLASS;

export function DashboardPanelLoading({
  kind,
}: {
  readonly kind: DashboardPanelKind;
}) {
  return (
    <div
      data-testid={`dashboard-${kind}-loading`}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <Skeleton className={`w-full ${PANEL_HEIGHT_CLASS[kind]}`} />
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
        className="btn-press inline-flex min-h-[var(--touch-target-min)] w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)]"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Retry
      </button>
    </section>
  );
}
