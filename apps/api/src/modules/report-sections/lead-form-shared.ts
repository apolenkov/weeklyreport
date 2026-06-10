import type {
  ReportSectionReadModel,
  VersionSnapshot,
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

/** Minimal shape returned by getLatestSnapshot for throttle/dedup checks. */
export interface SnapshotLatestRow {
  data: Record<string, unknown>;
  createdAt: Date;
  version: number;
}

/** Result shape returned by the public createSnapshot API. */
export type CreateSnapshotResult =
  | { version: number; skipped?: false }
  | { version: number; skipped: true; reason: "throttled" | "no-change" };

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean } | null>;
  revokeSectionSubmission(sectionId: string, revokedBy: string): Promise<void>;
  fillFromSection(
    targetSectionId: string,
    sourceSectionId: string,
  ): Promise<number>;
  listVersions(sectionId: string): Promise<VersionSnapshot[]>;
  getVersion(
    sectionId: string,
    version: number,
  ): Promise<Record<string, unknown> | null>;
  restoreVersion(sectionId: string, version: number): Promise<number>;
  createVersionSnapshot(sectionId: string): Promise<number>;
  /** Returns the most recent snapshot for a section, or null if none exists. */
  getLatestSnapshot(sectionId: string): Promise<SnapshotLatestRow | null>;
  /** Returns the snapshot projection for a section (same shape stored in VersionSnapshot.data). */
  buildSnapshotProjection(sectionId: string): Promise<Record<string, unknown>>;
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
      authorName: string;
      stageNames: string[];
      stages: {
        stageName: string;
        status: "green" | "yellow" | "red" | null;
      }[];
      itemCount: number;
      riskCount: number;
    }[]
  >;
  /** Returns full section content (items/risks/decisions) for cross-author leads
   *  who share at least one product with the requesting user, filtered to shared products only. */
  getCrossAuthorSections(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]>;
  /** SC-165: Revoke every submitted section in a report in one transaction. */
  revokeAllSubmitted(reportId: string, revokedBy: string): Promise<number>;
  /** add-version-pin: flip the kind of an existing snapshot to pinned/autosave. */
  setVersionPinned(
    sectionId: string,
    version: number,
    pinned: boolean,
  ): Promise<void>;
}

export interface CrossAuthorSectionRow {
  authorId: string;
  authorName: string;
  sharedProductIds: string[];
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
