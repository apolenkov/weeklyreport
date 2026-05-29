import type {
  PeriodState,
  PeriodStatus,
  ReportPeriod,
} from "@customreport/shared";

/**
 * fix-snapshot-lifecycle-restore: the complete governed lifecycle field set
 * an admin snapshot restore writes back to a `Report`. Mirrors the fields the
 * `period-dual-state` invariant protects so a restored row can never be left
 * in a state the invariant forbids.
 */
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

/**
 * Resolve the governed lifecycle field set for a snapshot restore.
 *
 * This is deliberately NOT a transition: it reinstates three independently
 * persisted state machines (periodState, the legacy status/archived tuple,
 * periodStatus) verbatim when the snapshot carries them. Routing it through
 * `buildTransition` would derive the coupled set from a single field and
 * corrupt legitimately-divergent rows — a reopened period is
 * `status="published"` while `periodState="open"` and
 * `periodStatus="reopened"`.
 *
 * Each field is resolved independently. A field present in the snapshot is
 * taken verbatim; only an ABSENT field (a legacy snapshot that predates the
 * extended schema) falls back to the documented legacy-tuple backfill — the
 * same rule the original `periodState` SQL migration used — so old snapshots
 * restore to an internally consistent row instead of a divergent one.
 */
export function resolveLifecycle(period: ReportPeriod): ResolvedLifecycle {
  const archived = period.archived ?? false;
  return {
    status: period.status,
    // Legacy backfill: archived → "archived"; published status → "published";
    // otherwise "open". Verbatim when the snapshot already carries it.
    periodState:
      period.periodState ??
      (archived
        ? "archived"
        : period.status === "published"
          ? "published"
          : "open"),
    archived,
    // Legacy backfill: published status → "published"; otherwise "open".
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
