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

// The report or section a write targets is gone. Extends Error directly (never
// ReportSectionDomainError) so the mapper table's one-row-per-error invariant
// holds and this surfaces as NOT_FOUND, not the BAD_REQUEST validation code.
export class ReportSectionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSectionNotFoundError";
  }
}

// Raised when a write's expected version no longer matches the stored row (a
// concurrent writer advanced it). Distinct from ReportSectionDomainError so the
// error-mapper surfaces CONFLICT (409) and the client reloads and retries.
export class SectionVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionVersionConflictError";
  }
}

export interface ReportPeriodWriteGate {
  periodStatus: PeriodStatus;
  archived: boolean;
}

export interface ReportSectionsRepository {
  getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null>;
  // Canonical lifecycle facts keyed on the section id. Both write paths decide
  // editability from this tuple — never the legacy Report.status column — so
  // reopen editing works while archived and published reports stay locked.
  getReportPeriodWriteGateForSection(
    sectionId: string,
  ): Promise<ReportPeriodWriteGate | null>;
  // Deadline-aware variant. Null means the report does not exist — the deadline
  // gate treats that as a NOT_FOUND integrity failure, never a free pass.
  // Required: an unimplemented reader would silently disable the deadline gate.
  getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date | null } | null>;
  // Resolve which CURRENT item/decision lineages have appeared in a published
  // report — the delete-lock reference set, required so an omitting repository
  // fails to compile. Risks are excluded: a risk is re-raised, not carried.
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }>;
  saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel>;
  // Every section authored by `authorId`, newest reporting-period first
  // (periodStart desc, createdAt tiebreak) — the raw rows behind myHistory.
  // See buildMyHistoryEntries for why the ordering must match compiledHistory.
  getMyHistoryRows(authorId: string): Promise<readonly MyHistorySectionRow[]>;
}

// DI token binding the ReportSectionsRepository port to its adapter at the
// module boundary — the service depends on the port, not the prisma class.
export const REPORT_SECTIONS_REPOSITORY = Symbol("ReportSectionsRepository");

// Minimal AppSettings shape for grace + late-submission rules, read through a
// callback so unit tests pass a tiny stub without standing up the admin module.
export type GetGraceSettings = () => Promise<{
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
}>;

export class ReportSectionsService {
  private readonly logger = createServiceLogger("ReportSectionsService");

  constructor(
    private readonly repository: ReportSectionsRepository,
    // Grace-period settings provider — required, or late stamping would
    // silently disable. submitSection: now > deadline + grace AND
    // !allowLateSubmissions → AccessError; now > deadline → section.late = true.
    private readonly getGraceSettings: GetGraceSettings,
    private readonly telemetry: ReportSectionsTelemetry = NOOP_REPORT_SECTIONS_TELEMETRY,
  ) {}

  private assertCanEditSection(
    section: ReportSectionReadModel,
    actorUserId: string,
  ): void {
    if (section.authorId !== actorUserId) {
      throw new ReportSectionAccessError("Can only edit your own section.");
    }
  }

  // Hard-reject a write whose new/changed row carries a stage the section
  // AUTHOR does not own on that product. Runs on both write paths before
  // persistence; the author's server-loaded ownedStages is the reference.
  private assertStageOwnership(
    section: ReportSectionReadModel,
    input: DraftSaveInput | SubmitSectionInput,
  ): void {
    const violation = validateStageOwnership(section, input).at(0);
    if (violation) {
      throw new ReportSectionDomainError(violation.code, violation.message);
    }
  }

  // Hard-reject a write whose activity slice carries an activityId not
  // attached/seeded for the author. The server-loaded seeded set is the
  // reference — the delete-recreate never trusts client-supplied ids.
  private assertActivityAttachment(
    section: ReportSectionReadModel,
    input: DraftSaveInput | SubmitSectionInput,
  ): void {
    // Two client-trust gaps, same seeded-set reference, same reject: the
    // status-slice guard plus the record-parent guard for rows parented by an
    // unattached activityId. First violation wins.
    const violation =
      validateActivityStatuses(section, input).at(0) ??
      validateRecordActivityIds(section, input).at(0);
    if (violation) {
      throw new ReportSectionDomainError(violation.code, violation.message);
    }
  }

  // Resolve-not-delete: a published-lineage item/decision cannot be dropped
  // from the section — stableId is client-authoritative on the payload, so
  // preservation is verified server-side (comparison in published-record-guard).
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

  private assertPeriodEditable(
    gate: ReportPeriodWriteGate | null,
    action: "edit" | "submit",
  ): void {
    if (gate === null) throw new ReportSectionNotFoundError("Missing report.");
    if (
      !gate.archived &&
      (gate.periodStatus === "open" || gate.periodStatus === "reopened")
    )
      return;

    throw new ReportSectionDomainError(
      "SECTION_ALREADY_SUBMITTED",
      `Cannot ${action} sections of a published report.`,
    );
  }

  // Deadline gate for submitSection: returns the `late` flag to stamp, and
  // throws AccessError (→403) when past deadline+grace AND late is forbidden.
  // Always armed; null meta → NOT_FOUND, never a silent on-time pass.
  private async evaluateDeadlineGate(reportId: string) {
    const meta = await this.repository.getReportMeta(reportId);
    if (!meta) {
      // The section just loaded references this report (FK), so a null meta
      // means the report row vanished mid-flight — fail closed, never an
      // un-gated on-time submission.
      throw new ReportSectionNotFoundError("The report no longer exists.");
    }
    if (meta.deadline === null) {
      this.logger.info("deadline gate skipped: period has no deadline", {
        reportId,
      });
      return { late: false, reportMeta: meta };
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
    // Writing actor is mandatory: the authenticated caller, never an optional
    // identity that would let a write slip through unowned. The router passes
    // `ctx.session.userId` (reports.router.ts).
    actorUserId: string,
  ): Promise<ReportSectionReadModel> {
    const parsedInput = draftSaveSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
    this.assertCanEditSection(section, actorUserId);

    const writeGate = await this.repository.getReportPeriodWriteGateForSection(
      section.reportSectionId,
    );

    this.assertPeriodEditable(writeGate, "edit");

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
      // Wall clock read at the boundary; mergeSection stays pure.
      mergeSection(section, parsedInput, "draft", new Date()),
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
    // Same mandatory writing-actor contract as saveDraft.
    actorUserId: string,
  ): Promise<ReportSectionReadModel> {
    const parsedInput = submitSectionSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
    this.assertCanEditSection(section, actorUserId);

    // Gate the destructive delete-recreate on the canonical period status, not
    // the legacy Report.status column: a section can sit in `draft` under a
    // published period, and submitting would rewrite rows the snapshot froze.
    const writeGate = await this.repository.getReportPeriodWriteGateForSection(
      section.reportSectionId,
    );

    this.assertPeriodEditable(writeGate, "submit");

    // Deadline gate runs BEFORE the content validator: a past-deadline submit
    // with late forbidden returns 403 even for a valid payload, while missing
    // traffic-lights fail on content first when within grace (most-specific error).
    const deadlineGate = await this.evaluateDeadlineGate(section.reportId);

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
      mergeSection(
        section,
        parsedInput,
        "submitted",
        new Date(),
        deadlineGate.late,
      ),
      parsedInput.version,
    );

    // Always bump the submission counter, labelled by the same `late` flag
    // persisted on the row, so dashboard math matches the UI badge. Telemetry
    // must never break the write path, hence the defensive try/catch.
    try {
      this.telemetry.recordSectionSubmitted(deadlineGate.late);
      const meta = deadlineGate.reportMeta;
      if (meta.deadline) {
        // Signed seconds: positive = late, negative = submitted early. A
        // cleared deadline has no reference point — no histogram sample.
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
      late: deadlineGate.late,
    });
    return saved;
  }

  // The lead's own section history, newest reporting-period first. Pure
  // post-processing lives in buildMyHistoryEntries; this threads the repo rows
  // through it.
  async myHistory(authorId: string): Promise<MyHistoryEntry[]> {
    const sections = await this.repository.getMyHistoryRows(authorId);
    return buildMyHistoryEntries(sections);
  }
}
