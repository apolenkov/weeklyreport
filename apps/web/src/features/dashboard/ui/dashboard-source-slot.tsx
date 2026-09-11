import type { ReactElement } from "react";

import { formatClientErrorMessage } from "../../../shared/lib/errors/client-error-reporting";
import {
  DashboardPanelIssue,
  type DashboardPanelKind,
  DashboardPanelLoading,
} from "./dashboard-panel-state";

export interface DashboardSourceState {
  readonly error: unknown;
  readonly isError: boolean;
  readonly retry: () => void;
  readonly stalled: boolean;
}

interface DashboardSourceSlotProps {
  readonly children: ReactElement | null;
  readonly kind: DashboardPanelKind;
  readonly ready: boolean;
  readonly source: DashboardSourceState;
  readonly title: string;
}

function sourceIssueDescription(
  source: DashboardSourceState,
  requestTitle: string,
  stalledTitle: string = requestTitle,
): string {
  return source.isError
    ? formatClientErrorMessage(`${requestTitle} request failed`, source.error)
    : `${stalledTitle} is taking longer than expected.`;
}

export function DashboardSourceSlot({
  children,
  kind,
  ready,
  source,
  title,
}: DashboardSourceSlotProps) {
  if (source.isError || source.stalled) {
    return (
      <DashboardPanelIssue
        kind={kind}
        title={`${title} unavailable`}
        description={sourceIssueDescription(source, title)}
        onRetry={source.retry}
      />
    );
  }
  return ready ? children : <DashboardPanelLoading kind={kind} />;
}

export function DashboardActivityIssue({
  source,
}: {
  readonly source: DashboardSourceState;
}) {
  if (!source.isError && !source.stalled) return null;
  return (
    <DashboardPanelIssue
      kind="leads"
      testId="dashboard-activity-error"
      title="Activity freshness unavailable"
      description={sourceIssueDescription(
        source,
        "Activity",
        "Activity freshness",
      )}
      onRetry={source.retry}
    />
  );
}

export function DashboardReviewIssue({
  ready,
  source,
}: {
  readonly ready: boolean;
  readonly source: DashboardSourceState;
}) {
  if (!source.isError && !source.stalled) {
    return ready ? null : (
      <p role="status" className="text-sm text-[var(--color-muted-foreground)]">
        Loading review data…
      </p>
    );
  }
  return (
    <DashboardPanelIssue
      kind="leads"
      testId="dashboard-review-error"
      title="Review data unavailable"
      description={sourceIssueDescription(source, "Review", "Review data")}
      onRetry={source.retry}
    />
  );
}
