import type {
  DbRole,
  ItemWorkflowStatus,
  ReportSectionReadModel,
  RiskSeverity,
  TrafficLightStatus,
} from "@customreport/shared";

export class LeadFormDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormDomainError";
  }
}

export class LeadFormAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormAccessError";
  }
}

// State conflict → BAD_REQUEST (vs LeadFormDomainError → NOT_FOUND).
export class ReopenRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReopenRequestError";
  }
}

// State conflict on an existing resource → BAD_REQUEST.
export class LeadFormConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormConstraintError";
  }
}

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  // Scoped load for revoke; out-of-group → null (no existence oracle).
  getSectionByIdScoped(
    sectionId: string,
    scope: Record<string, unknown>,
  ): Promise<ReportSectionReadModel | null>;
  // Head cross-read bounds requestedAuthorId to the head's single group.
  getUserReportingGroupId(userId: string): Promise<string | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    // archived is the Report flag, not a periodStatus value.
    reopenFacts: ReopenEligibilityFacts;
  } | null>;
  // Atomic group+section snapshot for head cross-read (no race window).
  getSectionForPeriodAsGroupPeer(
    reportId: string,
    authorId: string,
    peerUserId: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    reopenFacts: ReopenEligibilityFacts;
  } | null>;
  // Same rule as canRequestReopen; null when section missing.
  getSectionReopenContext(
    sectionId: string,
  ): Promise<{ authorId: string; facts: ReopenEligibilityFacts } | null>;
  // periodStatus (not status) so reopened periods stay fillable.
  getReportPeriodStatusForSection(sectionId: string): Promise<string | null>;
  // Published stableIds for lock marker; empty for never-published drafts.
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }>;
  revokeSectionSubmission(sectionId: string, revokedBy: string): Promise<void>;
  fillFromSection(
    targetSectionId: string,
    sourceSectionId: string,
    expectedVersion: number,
  ): Promise<number>;
  createReopenRequest(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<void>;
  // Shared non-archived products: both gate and content filter (cannot diverge).
  getSharedNonArchivedProductIds(
    viewerId: string,
    authorId: string,
  ): Promise<string[]>;
  getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorStatusRow[]>;
  // Full-content Everyone read; coOwnsShared distinguishes denied vs empty for metrics.
  getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }>;
  // Scope on updateMany so heads revoke only their group's submissions.
  revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
    scope: Record<string, unknown>,
  ): Promise<number>;
}

export interface CrossAuthorStatusRow {
  readonly projectId: string;
  readonly projectName: string;
  readonly authorId: string;
  readonly authorInitials: string;
  readonly authorShortName: string;
  readonly stageNames: string[];
  readonly stages: readonly {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

export interface CrossAuthorSectionRow {
  readonly authorId: string;
  readonly authorName: string;
  readonly authorRole: DbRole;
  readonly sharedProductIds: string[];
  readonly stages: readonly {
    projectId: string;
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
  readonly items: readonly {
    id: string;
    projectId: string;
    type: string;
    text: string;
    tag: string;
    workflowStatus: ItemWorkflowStatus;
    carriedOver: boolean;
    priorityRank: number | null;
    stageNames: string[];
  }[];
  readonly risks: readonly {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: RiskSeverity;
    stageNames: string[];
  }[];
  readonly decisions: readonly {
    id: string;
    productId: string;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageNames: string[];
  }[];
}

export interface ReopenEligibilityFacts {
  readonly sectionStatus: string;
  readonly periodStatus: string;
  readonly archived: boolean;
  readonly hasPendingReopen: boolean;
}

export type ReopenBlockedReason =
  | "not_submitted"
  | "period_archived"
  | "period_closed"
  | "pending_request_exists";

// Shared by canRequestReopen UI and requestReopen guard — check archived first.
export function computeReopenEligibility(facts: ReopenEligibilityFacts): {
  canRequestReopen: boolean;
  reason: ReopenBlockedReason | null;
} {
  if (facts.sectionStatus !== "submitted") {
    return { canRequestReopen: false, reason: "not_submitted" };
  }
  if (facts.archived) {
    return { canRequestReopen: false, reason: "period_archived" };
  }
  if (facts.periodStatus !== "open" && facts.periodStatus !== "reopened") {
    return { canRequestReopen: false, reason: "period_closed" };
  }
  if (facts.hasPendingReopen) {
    return { canRequestReopen: false, reason: "pending_request_exists" };
  }
  return { canRequestReopen: true, reason: null };
}

export function reopenBlockedMessage(reason: ReopenBlockedReason): string {
  switch (reason) {
    case "not_submitted":
      return "Only submitted sections can request a reopen.";
    case "period_archived":
      return "This period is archived; its sections can no longer be reopened.";
    case "period_closed":
      return "This period is published; ask Head to reopen the period before editing sections.";
    case "pending_request_exists":
      return "A reopen request for this section is already pending.";
  }
}

// Server-side initials so full name never crosses the status-only API boundary.
export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
