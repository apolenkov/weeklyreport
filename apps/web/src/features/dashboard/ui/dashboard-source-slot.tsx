import type { ReactElement } from "react";

import { formatClientErrorMessage } from "../../../lib/client-error-reporting";
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

export function DashboardSourceSlot({
  children,
  kind,
  ready,
  source,
  title,
}: DashboardSourceSlotProps) {
  if (source.isError || source.stalled) {
    const description = source.isError
      ? formatClientErrorMessage(`${title} request failed`, source.error)
      : `${title} is taking longer than expected.`;
    return (
      <DashboardPanelIssue
        kind={kind}
        title={`${title} unavailable`}
        description={description}
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
  const description = source.isError
    ? formatClientErrorMessage("Activity request failed", source.error)
    : "Activity freshness is taking longer than expected.";
  return (
    <DashboardPanelIssue
      kind="leads"
      testId="dashboard-activity-error"
      title="Activity freshness unavailable"
      description={description}
      onRetry={source.retry}
    />
  );
}
