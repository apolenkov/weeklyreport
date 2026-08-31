import type {
  PeriodState,
  PeriodStatus,
  ReopenRequestStatusFilter,
  ReportSectionStatus,
  UserSession,
} from "@customreport/shared";

export type { ReopenRequestStatusFilter } from "@customreport/shared";

export interface ListReopenRequestsInput {
  readonly status: ReopenRequestStatusFilter;
  readonly session: UserSession;
}

export interface DecideReopenRequestInput {
  readonly id: string;
  readonly decision: "approved" | "rejected";
  readonly reviewNote: string | null;
  readonly decidedBy: string;
  readonly session: UserSession;
}

export interface StageRow {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
}

export interface StageAssignmentCountRow {
  readonly projectId: string;
  readonly count: number;
}

// One reopen-request row joined with requester/reviewer identity and the
// owning section's report envelope — the Admin Panel + dashboard card shape.
export interface ReopenRequestRow {
  readonly id: string;
  readonly reportSectionId: string;
  readonly reason: string | null;
  readonly status: "pending" | "approved" | "rejected";
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
  readonly requestedBy: { id: string; name: string; email: string };
  readonly reviewedBy: { id: string; name: string; email: string } | null;
  readonly sectionStatus: ReportSectionStatus;
  readonly report: {
    id: string;
    weekLabel: string | null;
    periodStart: Date;
    periodEnd: Date;
  };
}

// Outcome of the race-safe decision transaction: `already-processed` lost a
// concurrent decision (zero CAS rows); `stale` won an approve whose section was
// already reopened elsewhere (auto-closed); `decided` is a real decision.
export type ReopenDecisionOutcome =
  | { kind: "already-processed" }
  | { kind: "stale" }
  | { kind: "decided"; decision: "approved" | "rejected" };

// One product's owning reporting group, or `null` when it belongs to none.
// The batched read returns one entry per requested id so the caller can key a
// lookup without re-deriving absence.
export interface ProductGroupOwnership {
  readonly productId: string;
  readonly group: { id: string; name: string } | null;
}

// Raw shape from `listPeriodsByState` before the service derives `canReopen` /
// `canArchive`. The service holds the AppSettings references so the repository
// stays settings-agnostic.
export interface PeriodRowFromRepo {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date | null;
  readonly publishedAt: Date | null;
  readonly periodState: PeriodState;
  readonly periodStatus: PeriodStatus;
  readonly archived: boolean;
  readonly autoPublished: boolean;
  readonly autoArchived: boolean;
  readonly submittedCount: number;
  readonly totalCount: number;
  readonly weekLabel: string | null;
}
