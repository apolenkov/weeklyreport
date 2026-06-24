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

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean } | null>;
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
  /** SC-165: Revoke every submitted section in a report in one transaction. */
  revokeAllSubmitted(reportId: string, revokedBy: string): Promise<number>;
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
