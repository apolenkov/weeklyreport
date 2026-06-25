import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  customreportCrossAuthorContentReadsTotal,
  customreportReopenRequestsTotal,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  type CrossAuthorSectionRow,
  LeadFormDomainError,
  type LeadFormRepository,
} from "./lead-form-shared";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./lead-form.service`) resolves unchanged.
// The error classes have a single definition (in `lead-form-shared.ts`) so
// `instanceof` checks in the tRPC error-mapper stay valid.
export type {
  CrossAuthorSectionRow,
  LeadFormRepository,
} from "./lead-form-shared";
export { LeadFormAccessError, LeadFormDomainError } from "./lead-form-shared";

/**
 * Lead-form facade: reopen / cross-author / revoke / by-period / fill-from.
 * The version-history and snapshot surfaces were removed entirely
 * (defer-versions-coming-soon); TODO(versions-v2) marks the re-entry points.
 */
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

    // viewer-report-surface-parity (review P1): refuse to mutate the live rows
    // of a PUBLISHED period. The viewer's published search reads live Item/Risk/
    // Decision rows, but the viewer content read serves the frozen publish
    // snapshot — letting fillFrom rewrite a (draft) section inside a published
    // report would make a viewer's search snippet reveal content absent from the
    // report they can open. saveDraft/saveSection already block published edits;
    // fillFrom was the one gap. Gate on periodStatus (the searchable column):
    // a reopened period (periodStatus='reopened') is editable again and is
    // excluded from the viewer's published search, so it stays allowed.
    const periodStatus =
      await this.repository.getReportPeriodStatusForSection(targetSectionId);
    if (periodStatus === "published") {
      throw new Error("Cannot fill a section of a published report.");
    }

    // Authorize the SOURCE section too. The fill-from picker only ever offers
    // the lead's OWN past sections (`LeadReportPeriod.sourceSectionId` is sourced
    // from `MyHistoryEntry.sectionId`), so any sourceSectionId authored by
    // someone else is a forged request — without this guard a lead could copy
    // another group's Item/Risk/Decision content into their own draft on an open
    // report. fillFrom copies your own history; it is never cross-author.
    const source = await this.repository.getSectionById(sourceSectionId);
    if (!source) {
      throw new Error(`Source section ${sourceSectionId} not found.`);
    }
    if (source.authorId !== userId) {
      throw new Error("Can only fill from your own section.");
    }

    // TODO(versions-v2): a pre-overwrite safety snapshot was taken here
    // until version snapshots were removed (defer-versions-coming-soon).
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
    );

    return { success: true, copiedItems };
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
    role?: Role,
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
  > {
    const isHeadLike = role === "head" || role === "admin";
    if (!isHeadLike) {
      const ownSection = await this.repository.getSectionForPeriod(
        reportId,
        userId,
      );
      if (!ownSection) {
        return [];
      }
    }
    return this.repository.getCrossAuthors(reportId, userId);
  }

  /**
   * Full-content cross-author read for the lead form's "Everyone" visibility
   * lens. Strictly more sensitive than the status-only `getCrossAuthors`, so
   * gated harder (design D6): the caller must (a) have access to the report —
   * own a section in it — AND (b) co-own the product whose foreign records are
   * requested. There is NO head/admin bypass: a head or admin who does not
   * co-own the product is denied, exactly like any other non-co-owner. The
   * gate never keys off the lead-form toggle (the toggle only decides whether
   * the request is issued, never whether it is authorized).
   *
   * The response payload is empty in BOTH the denied and the legitimately
   * empty case (no leak). Only the observability counter distinguishes them
   * (D6b): `denied` = no report access OR no co-ownership; `empty` = co-owns a
   * shared product but the co-owner authored no records; `allowed` = foreign
   * records returned.
   */
  async getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    // (a) Report access — own a section in this report. No role bypass.
    const ownSection = await this.repository.getSectionForPeriod(
      reportId,
      userId,
    );
    if (!ownSection) {
      customreportCrossAuthorContentReadsTotal.inc({ result: "denied" });
      return [];
    }

    // (b) Co-ownership + content. The repository returns `coOwnsShared`
    // separately from row-emptiness so denied and empty stay distinguishable.
    const { coOwnsShared, rows } = await this.repository.getCrossAuthorContent(
      reportId,
      userId,
    );
    if (!coOwnsShared) {
      customreportCrossAuthorContentReadsTotal.inc({ result: "denied" });
      return [];
    }

    customreportCrossAuthorContentReadsTotal.inc({
      result: rows.length > 0 ? "allowed" : "empty",
    });
    return rows;
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
