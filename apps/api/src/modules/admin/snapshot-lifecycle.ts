import type {
  PeriodState,
  PeriodStatus,
  ReportPeriod,
} from "@customreport/shared";

// Governed lifecycle fields a snapshot restore writes back (period-dual-state).
export interface ResolvedLifecycle {
  status: ReportPeriod["status"];
  periodState: PeriodState;
  periodStatus: PeriodStatus;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  publishedAt: Date | null;
  publishedById: string | null;
  reopenedAt: Date | null;
}

// Not a transition: reinstates three machines verbatim. Absent fields fall
// back to the legacy-tuple rule so old snapshots stay internally consistent.
// Spec: openspec/specs/period-dual-state
/**
 * Resolve Lifecycle.
 * @param period - The period argument.
 */
export function resolveLifecycle(period: ReportPeriod): ResolvedLifecycle {
  const archived = period.archived ?? false;
  return {
    status: period.status,
    periodState:
      period.periodState ??
      (archived
        ? "archived"
        : period.status === "published"
          ? "published"
          : "open"),
    archived,
    periodStatus:
      period.periodStatus ??
      (period.status === "published" ? "published" : "open"),
    autoPublished: period.autoPublished ?? false,
    autoArchived: period.autoArchived ?? false,
    publishedAt: period.publishedAt ?? null,
    publishedById: period.publishedById ?? null,
    reopenedAt: period.reopenedAt ?? null,
  };
}
