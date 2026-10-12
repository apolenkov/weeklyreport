import type {
  CurrentPeriodLifecycle,
  ReportPeriod,
} from "@weeklyreport/shared";

// Governed lifecycle fields a snapshot restore writes back (period-dual-state).
export type ResolvedLifecycle = CurrentPeriodLifecycle;

// Not a transition: reinstates the already-validated machines verbatim.
export function resolveLifecycle(period: ReportPeriod): ResolvedLifecycle {
  return {
    status: period.status,
    periodState: period.periodState,
    archived: period.archived,
    periodStatus: period.periodStatus,
    autoPublished: period.autoPublished,
    autoArchived: period.autoArchived,
    publishedAt: period.publishedAt,
    publishedById: period.publishedById,
    reopenedAt: period.reopenedAt,
  };
}
