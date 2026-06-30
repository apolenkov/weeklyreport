import type { ReportSectionReadModel } from "@customreport/shared";

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

/**
 * reopen-request-lifecycle (D4): a reopen request rejected by the period
 * lifecycle or the one-pending rule. A state conflict, not a missing resource,
 * so the tRPC error-mapper renders it BAD_REQUEST (distinct from
 * `LeadFormDomainError` → NOT_FOUND).
 */
export class ReopenRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReopenRequestError";
  }
}

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  /**
   * scope-leadform-revoke-authz: scoped variant of {@link getSectionById} used
   * by the revoke write path. `scope` is the `groupScopeFilter(session,
   * "reportSection")` fragment (a relation filter on `author.reportingGroupId`,
   * `{}` for admin); a section whose author is outside the caller's groups
   * resolves to null and is rejected as not-found (no existence oracle). The
   * shared `getSectionById` stays unscoped for its existing callers.
   */
  getSectionByIdScoped(
    sectionId: string,
    scope: Record<string, unknown>,
  ): Promise<ReportSectionReadModel | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    /**
     * reopen-request-lifecycle (D4): the period-lifecycle facts the service
     * needs to compute `canRequestReopen` without a second read. `archived`
     * is the explicit `Report` flag, NOT a `periodStatus` value.
     */
    reopenFacts: ReopenEligibilityFacts;
  } | null>;
  /**
   * reopen-request-lifecycle (D4): the lifecycle facts for a single section,
   * keyed by sectionId, so `requestReopen` can enforce the same rule the lead
   * form's `canRequestReopen` flag advertises. Null when the section is missing.
   * `authorId` lets the service keep the ownership check.
   */
  getSectionReopenContext(
    sectionId: string,
  ): Promise<{ authorId: string; facts: ReopenEligibilityFacts } | null>;
  /**
   * The `periodStatus` of the report owning `sectionId`, or null when the
   * section is missing. Used by fillFrom to refuse mutating a published
   * period's live rows (viewer-report-surface-parity: published search reads
   * live rows, the viewer read serves the frozen snapshot — they must not
   * diverge). `periodStatus`, not `status`: a reopened period (status stays
   * 'published', periodStatus='reopened') is editable again and is excluded
   * from the viewer's published search, so fillFrom stays allowed there.
   */
  getReportPeriodStatusForSection(sectionId: string): Promise<string | null>;
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
  /** Returns true when both users share at least one assigned project. */
  hasSharedProduct(userId1: string, userId2: string): Promise<boolean>;
  /** Returns other authors who share at least one project with userId, with per-project stats. */
  getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorInitials: string;
      authorShortName: string;
      stageNames: string[];
      stages: {
        stageName: string;
        status: "green" | "yellow" | "red" | null;
      }[];
    }[]
  >;
  /**
   * Full foreign section content (item / risk / decision text + the owning
   * author's full name + risk-derived foreign stage chips) for products the
   * caller CO-OWNS on the given report. This is the strictly-more-sensitive
   * "Everyone" read; the status-only `getCrossAuthors` is unchanged.
   *
   * Returns `coOwnsShared` so the caller can distinguish a denied read (caller
   * co-owns no shared product on a non-archived project) from a legitimately
   * empty one (caller co-owns a shared product, but the co-owner authored no
   * records). The `rows` payload is identical (`[]`) in both cases — only the
   * separate boolean lets the service label the observability metric. See D6b.
   */
  getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }>;
  /**
   * SC-165: Revoke every submitted section in a report. scope-leadform-revoke-authz:
   * `scope` is the caller's `reportSection` group-scope fragment spread into the
   * `updateMany` where, so a head revokes only their own group's submissions
   * (admin scope is `{}` → global).
   */
  revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
    scope: Record<string, unknown>,
  ): Promise<number>;
}

/**
 * Foreign section content scoped to products the caller co-owns. Revives the
 * pre-`scope-lead-report-to-own-contribution` shape and adds a risk-derived
 * per-stage `stages[]` projection so the "Everyone" lens can render foreign
 * stage chips with the canonical traffic-light status. Distinct from the
 * status-only cross-author row (initials + status, no text, no full name).
 */
export interface CrossAuthorSectionRow {
  authorId: string;
  authorName: string;
  sharedProductIds: string[];
  /** Risk-derived foreign stage chips per shared product (covers-all aware). */
  stages: {
    projectId: string;
    stageName: string;
    status: "green" | "yellow" | "red" | null;
  }[];
  items: {
    id: string;
    projectId: string;
    type: string;
    text: string;
    tag: string;
    workflowStatus: string;
    carriedOver: boolean;
    completed: boolean | null;
    priorityRank: number | null;
    stageNames: string[];
  }[];
  risks: {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
  }[];
  decisions: {
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

/**
 * reopen-request-lifecycle (D4): the period-lifecycle facts a reopen-request
 * decision turns on. `sectionStatus` is the `ReportSectionStatus`, `periodStatus`
 * the `PeriodStatus` (open/published/reopened), `archived` the explicit `Report`
 * flag, and `hasPendingReopen` whether the section already holds a pending
 * request.
 */
export interface ReopenEligibilityFacts {
  sectionStatus: string;
  periodStatus: string;
  archived: boolean;
  hasPendingReopen: boolean;
}

/**
 * Machine-readable reason a reopen request is not allowed, for logging and the
 * lead-form flag. `null` reason means it IS allowed.
 */
export type ReopenBlockedReason =
  | "not_submitted"
  | "period_archived"
  | "period_closed"
  | "pending_request_exists";

/**
 * reopen-request-lifecycle (D4): the single source of truth for whether a lead
 * may file a reopen request. Both the lead-form read (`canRequestReopen`) and
 * the `requestReopen` write guard call this, so the button and the server can
 * never drift. A request is allowed only for a `submitted` section on an
 * `open`/`reopened`, non-`archived` period with no pending request already.
 * `archived` is checked before `periodStatus` so an archived report yields the
 * more specific reason.
 */
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

/** Human-readable English message for a blocked reopen request. */
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

/**
 * Derives display initials from a user's full name, server-side, so the full
 * name never crosses the API boundary. First letters of up to two words,
 * uppercased (e.g. "Anna Karenina" -> "AK").
 */
export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
