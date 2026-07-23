import type {
  DbRole,
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

/**
 * A reopen request rejected by the period lifecycle or the one-pending rule.
 * A state conflict, not a missing resource, so the tRPC error-mapper renders
 * it BAD_REQUEST (distinct from `LeadFormDomainError` → NOT_FOUND).
 */
export class ReopenRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReopenRequestError";
  }
}

/**
 * A lead-form state-constraint violation on a resource that EXISTS — filling a
 * submitted section, filling a published period's section, or revoking a
 * non-submitted section. A state conflict, not a missing resource, so the tRPC
 * error-mapper renders it BAD_REQUEST (distinct from `LeadFormDomainError` →
 * NOT_FOUND). The state-conflict twin of `ReopenRequestError`.
 */
export class LeadFormConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormConstraintError";
  }
}

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  /**
   * Scoped variant of {@link getSectionById} used by the revoke write path.
   * `scope` is the `groupScopeFilter(session, "reportSection")` fragment (a
   * relation filter on `author.reportingGroupId`, `{}` for admin); a section
   * whose author is outside the caller's groups resolves to null and is
   * rejected as not-found (no existence oracle). The shared `getSectionById`
   * stays unscoped for its existing callers.
   */
  getSectionByIdScoped(
    sectionId: string,
    scope: Record<string, unknown>,
  ): Promise<ReportSectionReadModel | null>;
  /**
   * The reporting group id of a user, or null when the user has none. The head
   * cross-author read uses it to bound a client-supplied `requestedAuthorId` to
   * the head's own single reporting group before the target section is returned
   * (a head is a single-group role; admin never consults this).
   */
  getUserReportingGroupId(userId: string): Promise<string | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    /**
     * Period-lifecycle facts the service needs to compute `canRequestReopen`
     * without a second read. `archived` is the explicit `Report` flag, NOT a
     * `periodStatus` value.
     */
    reopenFacts: ReopenEligibilityFacts;
  } | null>;
  /**
   * Atomic, group-scoped twin of {@link getSectionForPeriod} for the head
   * cross-author read. Returns the `authorId` section on `reportId` ONLY if
   * the author's reporting group currently contains `peerUserId`, evaluated
   * as a single relation predicate in the SAME query as the read — the group
   * membership and the section come from one snapshot, so a group
   * reassignment concurrent with the read cannot slip a cross-group section
   * out (unlike a separate pre-check followed by an unscoped read, which
   * leaves a window between the two statements). `assertHeadTargetInGroup`
   * remains the fast pre-check for a clear 403 message; this method is the
   * enforcement. A `peerUserId` with no reporting group never matches and
   * yields null (fail closed).
   */
  getSectionForPeriodAsGroupPeer(
    reportId: string,
    authorId: string,
    peerUserId: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    reopenFacts: ReopenEligibilityFacts;
  } | null>;
  /**
   * Lifecycle facts for a single section, keyed by sectionId, so
   * `requestReopen` can enforce the same rule the lead form's
   * `canRequestReopen` flag advertises. Null when the section is missing.
   * `authorId` lets the service keep the ownership check.
   */
  getSectionReopenContext(
    sectionId: string,
  ): Promise<{ authorId: string; facts: ReopenEligibilityFacts } | null>;
  /**
   * The `periodStatus` of the report owning `sectionId`, or null when the
   * section is missing. Used by fillFrom to refuse mutating a published
   * period's live rows (published search reads live rows, the viewer read
   * serves the frozen snapshot — they must not diverge). `periodStatus`, not
   * `status`: a reopened period (status stays 'published',
   * periodStatus='reopened') is editable again and is excluded from the
   * viewer's published search, so fillFrom stays allowed there.
   */
  getReportPeriodStatusForSection(sectionId: string): Promise<string | null>;
  /**
   * Published lineage of the section's current item/decision rows (their
   * durable `stableId`s that appeared in a published report). Surfaced on
   * `getByPeriod` so the lead form can render the "in the published report"
   * marker and hide Delete on locked records — the server-side save guard
   * (report-sections service) stays the enforcement point. Required so a
   * repository omitting it fails to compile rather than silently disabling
   * the Fill From published-lineage lock; a never-published draft yields
   * empty lineage.
   */
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
  /**
   * The product ids both users hold a stage assignment on, restricted to
   * non-archived products. Drives BOTH the lead cross-author authorization gate
   * and the per-product content filter in `getByPeriod`, so the gate can never
   * admit a reader the filter then empties. Report-independent: report access is
   * proven separately by the caller's own-section read.
   */
  getSharedNonArchivedProductIds(
    viewerId: string,
    authorId: string,
  ): Promise<string[]>;
  /** Returns other authors who share at least one project with userId, with per-project stats. */
  getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorStatusRow[]>;
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
   * separate boolean lets the service label the observability metric.
   */
  getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }>;
  /**
   * Revoke every submitted section in a report. `scope` is the caller's
   * `reportSection` group-scope fragment spread into the `updateMany` where, so
   * a head revokes only their own group's submissions (admin scope is `{}` →
   * global).
   */
  revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
    scope: Record<string, unknown>,
  ): Promise<number>;
}

/**
 * The status-only cross-author row: initials + risk-derived per-stage status,
 * no record text. The strictly-more-sensitive full-content read is
 * `CrossAuthorSectionRow` below.
 */
export interface CrossAuthorStatusRow {
  projectId: string;
  projectName: string;
  authorId: string;
  authorInitials: string;
  authorShortName: string;
  stageNames: string[];
  stages: {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

/**
 * Foreign section content scoped to products the caller co-owns. Carries full
 * foreign text plus a risk-derived per-stage `stages[]` projection so the
 * "Everyone" lens can render foreign stage chips with the canonical
 * traffic-light status. Distinct from the status-only cross-author row
 * (initials + status, no text, no full name).
 */
export interface CrossAuthorSectionRow {
  authorId: string;
  authorName: string;
  /** The author's access role — the slide legend labels every author with it. */
  authorRole: DbRole;
  sharedProductIds: string[];
  /** Risk-derived foreign stage chips per shared product (covers-all aware). */
  stages: {
    projectId: string;
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
  items: {
    id: string;
    projectId: string;
    type: string;
    text: string;
    tag: string;
    workflowStatus: string;
    carriedOver: boolean;
    priorityRank: number | null;
    stageNames: string[];
  }[];
  risks: {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: RiskSeverity;
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
 * Period-lifecycle facts a reopen-request decision turns on. `sectionStatus`
 * is the `ReportSectionStatus`, `periodStatus` the `PeriodStatus`
 * (open/published/reopened), `archived` the explicit `Report` flag, and
 * `hasPendingReopen` whether the section already holds a pending request.
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
 * Single source of truth for whether a lead may file a reopen request. Both
 * the lead-form read (`canRequestReopen`) and the `requestReopen` write guard
 * call this, so the button and the server can never drift. A request is allowed
 * only for a `submitted` section on an `open`/`reopened`, non-`archived` period
 * with no pending request already. `archived` is checked before `periodStatus`
 * so an archived report yields the more specific reason.
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
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
