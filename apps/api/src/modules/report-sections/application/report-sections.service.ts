import {
  type DraftSaveInput,
  type DraftSavePayload,
  draftSaveSchema,
  type DraftSaveValidationError,
  MS_PER_HOUR,
  MS_PER_SECOND,
  type MyHistoryEntry,
  type PeriodStatus,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type ReportStatus,
  type SubmitSectionInput,
  type SubmitSectionPayload,
  submitSectionSchema,
  validateActivityStatuses,
  validateRecordActivityIds,
  validateStageOwnership,
  validateSubmitInput,
} from "@customreport/shared";

import { createServiceLogger } from "../../../lib/logger-service.js";
import {
  buildMyHistoryEntries,
  type MyHistorySectionRow,
} from "../domain/my-history.js";
import { findPublishedRecordViolation } from "../domain/published-record-guard.js";
import { mergeSection } from "../domain/report-section-merge.js";
import {
  NOOP_REPORT_SECTIONS_TELEMETRY,
  type ReportSectionsTelemetry,
} from "./report-sections-telemetry.port.js";

export class ReportSectionDomainError extends Error {
  constructor(
    readonly code: DraftSaveValidationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ReportSectionDomainError";
  }
}

export class ReportSectionAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSectionAccessError";
  }
}

/**
 * Raised when a section write's expected version no longer matches the stored
 * row (a concurrent writer advanced it). Distinct from ReportSectionDomainError
 * (BAD_REQUEST) so the error-mapper can surface it as CONFLICT (409) and the
 * client can reload-then-retry rather than treat it as a validation failure.
 */
export class SectionVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionVersionConflictError";
  }
}

export interface ReportSectionsRepository {
  getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null>;
  /**
   * Canonical period status of the section's report, keyed on the section id.
   * Both write paths decide editability from this — never the legacy
   * `Report.status` column — so reopen editing works and the published lock
   * still holds. Mirrors the lead-form port's identically named lookup, so the
   * two surfaces read one shared query shape.
   */
  getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<PeriodStatus | null>;
  /**
   * Deadline-aware variant. Returns `null` when the
   * report does not exist (caller treats that as "no gate to enforce").
   * Required: an unimplemented reader would silently disable the deadline
   * gate — a repository without deadline data must return null EXPLICITLY.
   */
  getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date } | null>;
  /**
   * Resolve which of the section's CURRENT item/decision lineages (stableIds)
   * have appeared in a published report — the delete-lock reference set
   * (resolve-not-delete, ADR 0015). Required so a repository omitting it fails
   * to compile rather than silently disabling the save-path delete lock. Risks
   * are excluded by design: a risk is re-raised, not carried.
   */
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }>;
  saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel>;
  /**
   * Every section authored by `authorId`, newest reporting-period first
   * (`report.periodStart desc`, `createdAt` stable tiebreak) — the raw rows
   * behind `ReportSectionsService.myHistory`. See `buildMyHistoryEntries`
   * for why this ordering must match `compiledHistory`.
   */
  getMyHistoryRows(authorId: string): Promise<readonly MyHistorySectionRow[]>;
}

// DI token binding the ReportSectionsRepository port to its adapter at the
// module boundary — the service depends on the port, not the prisma class.
export const REPORT_SECTIONS_REPOSITORY = Symbol("ReportSectionsRepository");

/**
 * Minimal AppSettings shape the service needs to enforce grace + late
 * submission rules. Modeled as a callback rather
 * than a direct settings-service dependency so unit tests can pass a tiny
 * stub without standing up the admin module.
 */
export type GetGraceSettings = () => Promise<{
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
}>;

export class ReportSectionsService {
  private readonly logger = createServiceLogger("ReportSectionsService");

  constructor(
    private readonly repository: ReportSectionsRepository,
    // Grace-period settings provider. Required — an unwired provider would
    // silently disable late stamping, a product behavior. submitSection
    // enforces:
    //   - now > deadline + gracePeriodHours AND !allowLateSubmissions
    //     → ReportSectionAccessError ("Past deadline; submissions closed.")
    //   - now > deadline (irrespective of grace) → section.late = true
    private readonly getGraceSettings: GetGraceSettings,
    private readonly telemetry: ReportSectionsTelemetry = NOOP_REPORT_SECTIONS_TELEMETRY,
  ) {}

  private assertCanEditSection(
    section: ReportSectionReadModel,
    actorUserId?: string,
  ): void {
    if (actorUserId && section.authorId !== actorUserId) {
      throw new ReportSectionAccessError("Can only edit your own section.");
    }
  }

  /**
   * lead-form-stage-access-integrity: hard-reject a write whose new/changed
   * item / risk / decision row carries a stage the section AUTHOR does not own
   * on that row's product. Runs on both write paths before persistence; the
   * author's server-loaded `ownedStages` is the reference, so a head/admin
   * on-behalf edit cannot inject an unowned stage either.
   */
  private assertStageOwnership(
    section: ReportSectionReadModel,
    input: DraftSaveInput | SubmitSectionInput,
  ): void {
    const violation = validateStageOwnership(section, input).at(0);
    if (violation) {
      throw new ReportSectionDomainError(violation.code, violation.message);
    }
  }

  /**
   * Hard-reject a write whose activity-status slice carries an activityId not
   * attached/seeded for the section author. The server-loaded seeded set is
   * the reference — the delete-recreate never trusts client-supplied ids
   * (same gap class the stage-ownership guard closes). Runs on both write
   * paths before persistence.
   */
  private assertActivityAttachment(
    section: ReportSectionReadModel,
    input: DraftSaveInput | SubmitSectionInput,
  ): void {
    // Two client-trust gaps, same seeded-set reference and same
    // ACTIVITY_NOT_ATTACHED reject: the status-slice guard
    // (`validateActivityStatuses`) plus the record-parent guard
    // (`validateRecordActivityIds`, Decision 7) for any item/risk/decision
    // parented by an unattached activityId. First violation wins.
    const violation =
      validateActivityStatuses(section, input).at(0) ??
      validateRecordActivityIds(section, input).at(0);
    if (violation) {
      throw new ReportSectionDomainError(violation.code, violation.message);
    }
  }

  /**
   * Resolve-not-delete (ADR 0015): a published-lineage item/decision cannot be
   * dropped from the section — `stableId` is CLIENT-authoritative on the save
   * payload, so preservation is verified server-side. The pure comparison lives
   * in `published-record-guard.ts`.
   */
  private async assertPublishedRecordsPreserved(
    section: ReportSectionReadModel,
    input: DraftSaveInput | SubmitSectionInput,
  ): Promise<void> {
    const published = await this.repository.getPublishedLineage(section);
    const violation = findPublishedRecordViolation(published, input);
    if (violation) {
      throw new ReportSectionDomainError(violation.code, violation.message);
    }
  }

  /**
   * Deadline gate for submitSection. Returns the
   * `late` flag to stamp on the section. Throws ReportSectionAccessError
   * (→ 403 in the tRPC layer) when the deadline has passed beyond the
   * configured grace window AND late submissions are forbidden.
   *
   * Both collaborators are required, so the gate is always armed; the only
   * skip is an explicit `null` from `getReportMeta` (report absent).
   */
  private async evaluateDeadlineGate(reportId: string) {
    const meta = await this.repository.getReportMeta(reportId);
    if (!meta) {
      return { late: false, reportMeta: null };
    }
    const settings = await this.getGraceSettings();
    const now = Date.now();
    const deadlineMs = meta.deadline.getTime();
    if (now <= deadlineMs) {
      return { late: false, reportMeta: meta };
    }
    const graceMs = settings.gracePeriodHours * MS_PER_HOUR;
    if (now > deadlineMs + graceMs && !settings.allowLateSubmissions) {
      throw new ReportSectionAccessError("Past deadline; submissions closed.");
    }
    // now > deadline (possibly within grace, or grace+late allowed) → stamp late.
    return { late: true, reportMeta: meta };
  }

  async getActiveSection(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel> {
    const section = await this.repository.getSectionById(reportSectionId);

    if (!section) {
      throw new Error(`Report section ${reportSectionId} was not found.`);
    }

    return reportSectionReadModelSchema.parse(section);
  }

  async saveDraft(
    input: DraftSavePayload,
    actorUserId?: string,
  ): Promise<ReportSectionReadModel> {
    const parsedInput = draftSaveSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
    this.assertCanEditSection(section, actorUserId);

    const periodStatus = await this.repository.getReportPeriodStatusForSection(
      section.reportSectionId,
    );

    if (periodStatus === "published") {
      throw new ReportSectionDomainError(
        "SECTION_ALREADY_SUBMITTED",
        "Cannot edit sections of a published report.",
      );
    }

    if (section.status === "submitted") {
      throw new ReportSectionDomainError(
        "SECTION_ALREADY_SUBMITTED",
        "Submitted sections are read-only.",
      );
    }

    this.assertStageOwnership(section, parsedInput);
    this.assertActivityAttachment(section, parsedInput);
    await this.assertPublishedRecordsPreserved(section, parsedInput);

    const saved = await this.repository.saveSection(
      mergeSection(section, parsedInput, "draft"),
      // Expected version is the CLIENT-loaded value, not the freshly-fetched
      // row's — otherwise the compare-and-set always matches and the lock is a
      // no-op.
      parsedInput.version,
    );
    this.logger.info("section draft saved", {
      reportSectionId: parsedInput.reportSectionId,
      authorId: section.authorId,
    });
    return saved;
  }

  async submitSection(
    input: SubmitSectionPayload,
    actorUserId?: string,
  ): Promise<ReportSectionReadModel> {
    const parsedInput = submitSectionSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
    this.assertCanEditSection(section, actorUserId);

    // Gate the destructive delete-recreate on the canonical period status, not
    // the legacy Report.status column. A section can sit in `draft` under a
    // published period (publishing never flips section statuses), and submitting
    // it would rewrite the live rows the frozen snapshot no longer matches.
    const periodStatus = await this.repository.getReportPeriodStatusForSection(
      section.reportSectionId,
    );

    if (periodStatus === "published") {
      throw new ReportSectionDomainError(
        "SECTION_ALREADY_SUBMITTED",
        "Cannot submit sections of a published report.",
      );
    }

    // Deadline gate runs BEFORE the content validator so a past-deadline
    // submission with !allowLateSubmissions
    // returns 403 even when the payload is otherwise valid. Conversely
    // a payload with missing traffic-lights still fails on the content
    // check first when within grace window — UX wants the most-specific
    // error, and "you forgot a traffic light" beats "you're late" when
    // both are true.
    const deadlineGate = await this.evaluateDeadlineGate(section.reportId);
    const { late } = deadlineGate;

    // Integrity before completeness: a stage the author does not own is a hard
    // authz reject, checked before the traffic-light / current-item nags.
    this.assertStageOwnership(section, parsedInput);
    this.assertActivityAttachment(section, parsedInput);
    await this.assertPublishedRecordsPreserved(section, parsedInput);

    const errors = validateSubmitInput(section, parsedInput);

    if (errors.length > 0) {
      const firstError = errors.at(0);
      // `errors.length > 0` guarantees firstError exists, but TS narrows the
      // tuple access to `T | undefined` — explicit guard satisfies strict.
      if (firstError) {
        throw new ReportSectionDomainError(firstError.code, firstError.message);
      }
    }

    const saved = await this.repository.saveSection(
      mergeSection(section, parsedInput, "submitted", late),
      parsedInput.version,
    );

    // Product telemetry. We always bump the submission counter, labelled by
    // the same `late` flag persisted on the row, so dashboard math matches
    // the badge in the UI. The latency histogram reuses the meta the gate
    // already fetched (null = report row gone → no histogram point). Wrapped
    // in a defensive try/catch because telemetry MUST NOT break the write
    // path.
    try {
      this.telemetry.recordSectionSubmitted(late);
      const meta = deadlineGate.reportMeta;
      if (meta) {
        // Signed seconds: positive = late, negative = submitted early.
        const deltaSeconds =
          (Date.now() - meta.deadline.getTime()) / MS_PER_SECOND;
        this.telemetry.observeSubmissionLatency(deltaSeconds);
      }
    } catch {
      // Never let metric emission corrupt the submit response.
    }

    this.logger.info("section submitted", {
      reportSectionId: parsedInput.reportSectionId,
      authorId: section.authorId,
      late,
    });
    return saved;
  }

  /**
   * The lead's own section history — every section they authored, newest
   * reporting-period first. Pure post-processing (traffic-light folding,
   * distinct-product counting, last-edit resolution) lives in
   * `buildMyHistoryEntries`; this method only threads the repository rows
   * through it.
   */
  async myHistory(authorId: string): Promise<MyHistoryEntry[]> {
    const sections = await this.repository.getMyHistoryRows(authorId);
    return buildMyHistoryEntries(sections);
  }
}
