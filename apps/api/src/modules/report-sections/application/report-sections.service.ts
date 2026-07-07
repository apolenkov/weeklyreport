import {
  type DraftSaveInput,
  type DraftSavePayload,
  draftSaveSchema,
  type DraftSaveValidationError,
  MS_PER_HOUR,
  MS_PER_SECOND,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type SubmitSectionInput,
  type SubmitSectionPayload,
  submitSectionSchema,
  validateActivityStatuses,
  validateRecordActivityIds,
  validateStageOwnership,
  validateSubmitInput,
} from "@customreport/shared";

import {
  customreportSectionsSubmittedTotal,
  customreportSectionSubmissionLatencySeconds,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { createServiceLogger } from "../../../lib/logger-service.js";
import { findPublishedRecordViolation } from "../domain/published-record-guard.js";
import { mergeSection } from "../domain/report-section-merge.js";

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
  getReportStatus(reportId: string): Promise<string | null>;
  /**
   * Deadline-aware variant. Returns `null` when the
   * report does not exist (caller treats that as "no gate to enforce").
   * Kept optional so legacy in-memory test repositories that predate the
   * 50-B grace-period gate keep compiling — the service falls back to
   * `getReportStatus` and skips the late-flag computation when this is
   * not implemented.
   */
  getReportMeta?(
    reportId: string,
  ): Promise<{ status: string; deadline: Date } | null>;
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
}

// DI token binding the ReportSectionsRepository port to its adapter at the
// module boundary — the service depends on the port, not the prisma class.
export const REPORT_SECTIONS_REPOSITORY = Symbol("ReportSectionsRepository");

/**
 * Minimal AppSettings shape the service needs to enforce grace + late
 * submission rules. Modeled as a callback rather
 * than a direct AdminService dependency so unit tests can pass a tiny
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
    // Optional grace-period settings provider. When wired, submitSection
    // enforces:
    //   - now > deadline + gracePeriodHours AND !allowLateSubmissions
    //     → ReportSectionAccessError ("Past deadline; submissions closed.")
    //   - now > deadline (irrespective of grace) → section.late = true
    // When undefined (test seam / legacy fixtures), the gate is skipped
    // and late stays false — preserves pre-50-B behaviour.
    private readonly getGraceSettings?: GetGraceSettings,
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
   * Skips entirely when the grace-settings provider is not wired (test
   * seam) or when the repository cannot report the report's deadline
   * (back-compat fall-through for in-memory repos that predate 50-B).
   */
  private async evaluateDeadlineGate(reportId: string): Promise<boolean> {
    if (!this.getGraceSettings || !this.repository.getReportMeta) {
      return false;
    }
    const meta = await this.repository.getReportMeta(reportId);
    if (!meta) {
      return false;
    }
    const settings = await this.getGraceSettings();
    const now = Date.now();
    const deadlineMs = meta.deadline.getTime();
    if (now <= deadlineMs) {
      return false;
    }
    const graceMs = settings.gracePeriodHours * MS_PER_HOUR;
    if (now > deadlineMs + graceMs && !settings.allowLateSubmissions) {
      throw new ReportSectionAccessError("Past deadline; submissions closed.");
    }
    // now > deadline (possibly within grace, or grace+late allowed) → stamp late.
    return true;
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

    const reportStatus = await this.repository.getReportStatus(
      section.reportId,
    );

    if (reportStatus === "published") {
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

    // Deadline gate runs BEFORE the content validator so a past-deadline
    // submission with !allowLateSubmissions
    // returns 403 even when the payload is otherwise valid. Conversely
    // a payload with missing traffic-lights still fails on the content
    // check first when within grace window — UX wants the most-specific
    // error, and "you forgot a traffic light" beats "you're late" when
    // both are true.
    const late = await this.evaluateDeadlineGate(section.reportId);

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
    // the same `late` flag persisted on
    // the row, so dashboard math matches the badge in the UI. The
    // latency histogram observes signed seconds (deadline − now) — but
    // only when the repository can report the deadline (the in-memory
    // back-compat repos predate `getReportMeta`). Wrapped in a defensive
    // try/catch because telemetry MUST NOT break the write path.
    try {
      customreportSectionsSubmittedTotal.inc({ late: String(late) });
      if (this.repository.getReportMeta) {
        const meta = await this.repository.getReportMeta(section.reportId);
        if (meta) {
          // Signed seconds: positive = late, negative = submitted early.
          const deltaSeconds =
            (Date.now() - meta.deadline.getTime()) / MS_PER_SECOND;
          customreportSectionSubmissionLatencySeconds.observe(deltaSeconds);
        }
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
}
