import type {
  PeriodState,
  PeriodStatus,
  ReportSectionStatus,
  UserSession,
} from "@customreport/shared";

export type ReopenRequestStatusFilter =
  "pending" | "approved" | "rejected" | "all";

export interface ListReopenRequestsInput {
  status: ReopenRequestStatusFilter;
  session: UserSession;
}

export interface DecideReopenRequestInput {
  id: string;
  decision: "approved" | "rejected";
  reviewNote: string | null;
  decidedBy: string;
  session: UserSession;
}

export interface StageRow {
  id: string;
  name: string;
  sortOrder: number;
}

export interface StageAssignmentCountRow {
  projectId: string;
  count: number;
}

/**
 * One reopen-request row, joined with requester/reviewer identity and the
 * owning section's report envelope — the shape the Admin Panel "Reopen
 * Requests" tab and the head dashboard card render directly.
 */
export interface ReopenRequestRow {
  id: string;
  reportSectionId: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  requestedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  sectionStatus: ReportSectionStatus;
  report: {
    id: string;
    weekLabel: string | null;
    periodStart: Date;
    periodEnd: Date;
  };
}

/**
 * Outcome of the race-safe decision transaction. `already-processed` is the
 * loser of a concurrent decision (zero rows matched the compare-and-set);
 * `stale` is a winning approve whose section was already reopened elsewhere
 * (auto-closed to rejected); `decided` is a real decision.
 */
export type ReopenDecisionOutcome =
  | { kind: "already-processed" }
  | { kind: "stale" }
  | { kind: "decided"; decision: "approved" | "rejected" };

/**
 * One product's owning reporting group, or `null` when the product belongs to
 * no group. The batched ownership read returns one entry per requested
 * product id so the caller can key a lookup without re-deriving absence.
 */
export interface ProductGroupOwnership {
  productId: string;
  group: { id: string; name: string } | null;
}

/**
 * The raw shape returned by `listPeriodsByState`
 * before the service layer derives `canReopen` / `canArchive`. The
 * service holds the AppSettings references (`allowReopenAfterPublish`,
 * `reopenWindowHours`) so the repository stays settings-agnostic.
 */
export interface PeriodRowFromRepo {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  publishedAt: Date | null;
  periodState: PeriodState;
  periodStatus: PeriodStatus;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  submittedCount: number;
  totalCount: number;
  weekLabel: string | null;
}
