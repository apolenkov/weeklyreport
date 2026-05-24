import type {
  ReportSectionReadModel,
  Role,
  VersionSnapshot,
} from "@customreport/shared";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";

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
  getVersion(sectionId: string, version: number): Promise<Record<string, unknown> | null>;
  restoreVersion(sectionId: string, version: number): Promise<number>;
  createVersionSnapshot(sectionId: string): Promise<number>;
  /** Returns the most recent snapshot for a section, or null if none exists. */
  getLatestSnapshot(sectionId: string): Promise<SnapshotLatestRow | null>;
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
      stages: { stageName: string; status: "green" | "yellow" | "red" | null }[];
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
  revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
  ): Promise<number>;
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
    stageName: string | null;
  }[];
  risks: {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageName: string | null;
  }[];
  decisions: {
    id: string;
    productId: string;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageName: string | null;
  }[];
}

/** Minimum time between autosave-triggered snapshots for a single section. */
const SNAPSHOT_THROTTLE_MS = 60_000;

/**
 * Stable JSON serialisation with sorted object keys so equivalent payloads
 * compare equal regardless of property insertion order.
 * Used for content-based dedup in createSnapshot.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${(value as unknown[]).map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    return `${JSON.stringify(k)}:${stableStringify(v)}`;
  });
  return `{${parts.join(",")}}`;
}

export class LeadFormService {
  constructor(private readonly repository: LeadFormRepository) {}

  /** API-03: Revoke a lead's submission (head-only). */
  async revokeSubmission(
    sectionId: string,
    revokedByUserId: string,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.status !== "submitted") {
      throw new Error("Only submitted sections can be revoked.");
    }

    await this.repository.revokeSectionSubmission(sectionId, revokedByUserId);
    return { success: true };
  }

  /** API-07: Fill current form from a past period's data. */
  async fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
  ): Promise<{ success: true; copiedItems: number }> {
    const target = await this.repository.getSectionById(targetSectionId);

    if (!target) {
      throw new Error(`Target section ${targetSectionId} not found.`);
    }

    if (target.authorId !== userId) {
      throw new Error("Can only fill your own section.");
    }

    if (target.status === "submitted") {
      throw new Error("Cannot fill a submitted section.");
    }

    // Create a version snapshot before overwriting
    await this.repository.createVersionSnapshot(targetSectionId);
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
    );

    return { success: true, copiedItems };
  }

  /** API-08: List version snapshots for a section. */
  async listVersions(
    sectionId: string,
    userId: string,
    role?: Role,
  ): Promise<VersionSnapshot[]> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    const isHeadLike = role === "head" || role === "admin";
    const canView =
      section.authorId === userId ||
      isHeadLike ||
      (role === "lead" &&
        (await this.repository.hasSharedProduct(userId, section.authorId)));
    if (!canView) {
      throw new LeadFormAccessError(
        "Can only list versions for your own section.",
      );
    }

    return this.repository.listVersions(sectionId);
  }

  async getVersion(
    sectionId: string,
    version: number,
    userId: string,
    role?: Role,
  ): Promise<Record<string, unknown> | null> {
    const section = await this.repository.getSectionById(sectionId);
    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }
    const isHeadLike = role === "head" || role === "admin";
    const canView =
      section.authorId === userId ||
      isHeadLike ||
      (role === "lead" &&
        (await this.repository.hasSharedProduct(userId, section.authorId)));
    if (!canView) {
      throw new LeadFormAccessError("Access denied.");
    }
    return this.repository.getVersion(sectionId, version);
  }

  /** API-09: Restore a section to a specific version. */
  async restoreVersion(
    sectionId: string,
    version: number,
    userId: string,
  ): Promise<{ success: true; restoredVersion: number }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only restore your own section.");
    }

    if (section.status === "submitted") {
      throw new Error("Cannot restore a submitted section.");
    }

    // Create snapshot of current state before restoring
    await this.repository.createVersionSnapshot(sectionId);
    const restoredVersion = await this.repository.restoreVersion(
      sectionId,
      version,
    );

    return { success: true, restoredVersion };
  }

  /**
   * Create an explicit version snapshot of the current section state.
   *
   * Used by:
   * - The "Save Version" button on the lead form (manual checkpoint).
   * - The autosave hook on every successful autosave (silent safety net).
   *
   * Validates ownership and skips when the section is submitted (locked
   * sections shouldn't accumulate snapshots — there's nothing changing).
   *
   * Server-side throttle + dedup applied before writing:
   * - Throttle: at most one snapshot per 60 s per section (silently skipped).
   * - Content dedup: if the section data hasn't changed vs. the last snapshot,
   *   the write is silently skipped.
   * Time-based retention (all <24 h / hourly 24 h–7 d / daily 7–30 d /
   * drop >30 d) is enforced inside the repository.
   *
   * Internal callers (fillFrom, restoreVersion) call
   * repository.createVersionSnapshot() directly and bypass throttle — those
   * are safety-net snapshots that must always fire.
   */
  async createSnapshot(
    sectionId: string,
    userId: string,
  ): Promise<CreateSnapshotResult> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only snapshot your own section.");
    }

    if (section.status === "submitted") {
      throw new Error("Cannot snapshot a submitted section.");
    }

    const latest = await this.repository.getLatestSnapshot(sectionId);

    if (latest) {
      // Throttle: skip if last snapshot is less than 60 seconds ago
      const ageMs = Date.now() - latest.createdAt.getTime();
      if (ageMs < SNAPSHOT_THROTTLE_MS) {
        return { version: latest.version, skipped: true, reason: "throttled" };
      }

      // Content dedup: skip if data is byte-identical to the latest snapshot
      if (stableStringify(latest.data) === stableStringify(section)) {
        return { version: latest.version, skipped: true, reason: "no-change" };
      }
    }

    const version = await this.repository.createVersionSnapshot(sectionId);
    return { version };
  }

  /** API-04: Request the head to reopen a submitted section. */
  async requestReopen(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only request reopen for your own section.");
    }

    if (section.status !== "submitted") {
      throw new Error("Only submitted sections can request reopen.");
    }

    await this.repository.createReopenRequest(sectionId, userId, reason);
    // Phase 52-A (UFB-054): product telemetry. `state='requested'` is the
    // funnel's entry — paired with `approved` / `rejected` from the admin
    // mutation it gives leadership the full demand-vs-policy picture.
    customreportReopenRequestsTotal.inc({ state: "requested" });
    return { success: true };
  }

  /** API-10: Get lead form for a specific period. */
  async getByPeriod(
    reportId: string,
    userId: string,
    role?: Role,
    requestedAuthorId?: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean }> {
    const isHeadLike = role === "head" || role === "admin";
    const canViewOtherAuthor =
      isHeadLike ||
      (role === "lead" &&
        requestedAuthorId !== undefined &&
        (await this.repository.hasSharedProduct(userId, requestedAuthorId)));
    const sectionAuthorId =
      requestedAuthorId && canViewOtherAuthor ? requestedAuthorId : userId;
    const result = await this.repository.getSectionForPeriod(
      reportId,
      sectionAuthorId,
    );

    if (!result) {
      throw new LeadFormDomainError(
        `No section found for user in report ${reportId}.`,
      );
    }

    return {
      ...result,
      readOnly: result.readOnly || sectionAuthorId !== userId,
    };
  }

  async getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorName: string;
      stageNames: string[];
      stages: { stageName: string; status: "green" | "yellow" | "red" | null }[];
      itemCount: number;
      riskCount: number;
    }[]
  > {
    return this.repository.getCrossAuthors(reportId, userId);
  }

  async getCrossAuthorSections(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    return this.repository.getCrossAuthorSections(reportId, userId);
  }

  /** SC-165: Revoke every submitted section in a report in one transaction. */
  async revokeAllSubmitted(
    reportId: string,
    revokedByUserId: string,
  ): Promise<{ success: true; revokedCount: number }> {
    const count = await this.repository.revokeAllSubmitted(
      reportId,
      revokedByUserId,
    );
    return { success: true, revokedCount: count };
  }
}
