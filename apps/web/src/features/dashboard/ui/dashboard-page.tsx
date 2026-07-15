"use client";

import { useContext } from "react";

import { SessionContext } from "../../../lib/session-provider";
import { DashboardContent } from "./dashboard-content";
import { useDashboardData } from "./use-dashboard-data";

export { DASHBOARD_LOAD_STALL_MS } from "./use-dashboard-query-recovery";

function DashboardNoPeriod() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Dashboard
        </h1>
      </header>
      <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <p className="text-lg font-semibold text-[var(--color-foreground)]">
          No active reporting period
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Ask an admin to open a new period to start collecting status reports.
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const session = useContext(SessionContext);
  const data = useDashboardData();
  if (data.weeklyQ.data?.status === "no-period") {
    return <DashboardNoPeriod />;
  }

  return (
    <DashboardContent
      organizationName={session?.organization?.fullName ?? "CustomReport"}
      review={data.reviewQ.data}
      reviewState={{
        error: data.reviewQ.error,
        isError: data.reviewQ.isError,
        ...data.reviewRecovery,
      }}
      weeklyReport={data.weeklyQ.data}
      weeklyState={{
        error: data.weeklyQ.error,
        isError: data.weeklyQ.isError,
        ...data.weeklyRecovery,
      }}
      revokeAllPending={data.revokeAllMutation.isPending}
      onRevokeAll={(reportId) => data.revokeAllMutation.mutate({ reportId })}
      onRefreshDashboard={data.refreshDashboardData}
    />
  );
}
