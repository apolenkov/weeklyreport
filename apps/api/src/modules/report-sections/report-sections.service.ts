import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submitSectionSchema,
  validateSubmitInput,
  type DraftSavePayload,
  type DraftSaveValidationError,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from "@customreport/shared";

import {
  customreportSectionsSubmittedTotal,
  customreportSectionSubmissionLatencySeconds,
} from "../../infrastructure/metrics/metrics.registry.js";
import { createAppLogger } from "../../lib/logger.js";

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

export interface ReportSectionsRepository {
  getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null>;
  getReportStatus(reportId: string): Promise<string | null>;
  /**
   * UFB-049 / Phase 50-B: deadline-aware variant. Returns `null` when the
   * report does not exist (caller treats that as "no gate to enforce").
   * Kept optional so legacy in-memory test repositories that predate the
   * 50-B grace-period gate keep compiling — the service falls back to
   * `getReportStatus` and skips the late-flag computation when this is
   * not implemented.
   */
  getReportMeta?(
    reportId: string,
  ): Promise<{ status: string; deadline: Date } | null>;
  saveSection(section: ReportSectionReadModel): Promise<ReportSectionReadModel>;
}

/**
 * UFB-049 / Phase 50-B: minimal AppSettings shape the service needs to
 * enforce grace + late submission rules. Modeled as a callback rather
 * than a direct AdminService dependency so unit tests can pass a tiny
 * stub without standing up the admin module.
 */
export type GetGraceSettings = () => Promise<{
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
}>;

function mergeSection(
  section: ReportSectionReadModel,
  input: DraftSavePayload | SubmitSectionPayload,
  nextStatus: "draft" | "submitted",
  // UFB-049 / Phase 50-B: explicit late flag set by submitSection when
  // `now > Report.deadline` at submit-time. Defaults to whatever the
  // existing section row already carries so saveDraft / reopen paths
  // don't accidentally clear a previously-stamped late flag.
  late?: boolean,
): ReportSectionReadModel {
  const stageStatusByKey = new Map(
    (input.stageStatuses ?? []).map((status) => [
      `${status.projectId}::${status.stageId}`,
      status.status ?? null,
    ]),
  );

  const aggregateTrafficLight = (
    ownedStages: NonNullable<
      ReportSectionReadModel["projects"][number]["ownedStages"]
    >,
  ) => {
    let severity = 0;
    for (const stage of ownedStages) {
      if (stage.status === "red") {
        severity = 3;
        break;
      }
      if (stage.status === "yellow") severity = Math.max(severity, 2);
      if (stage.status === "green") severity = Math.max(severity, 1);
    }
    return severity === 3
      ? "red"
      : severity === 2
        ? "yellow"
        : severity === 1
          ? "green"
          : null;
  };
  const leadOwnedDecisions = input.decisions.map((decision) => ({
    ...decision,
    // The lead form owner input is read-only and represents the section owner.
    // Persisting a stale display name here makes the lead's own rows look
    // foreign and disables edit/delete in the UI.
    owner: section.authorName,
  }));

  return reportSectionReadModelSchema.parse({
    ...section,
    status: nextStatus,
    submittedAt: nextStatus === "submitted" ? new Date() : section.submittedAt,
    late: late ?? section.late ?? false,
    projects: section.projects
      .map((project) => ({
        ...project,
        ownedStages: (project.ownedStages ?? []).map((stage) => {
          const key = `${project.projectId}::${stage.stageId}`;
          if (!stageStatusByKey.has(key)) return stage;
          return { ...stage, status: stageStatusByKey.get(key) ?? null };
        }),
      }))
      .map((project) => {
        const trafficLight =
          aggregateTrafficLight(project.ownedStages ?? []) ??
          input.projectStatuses.find(
            (status) => status.projectId === project.projectId,
          )?.status ??
          null;

        return { ...project, trafficLight };
      }),
    items: input.items,
    risks: input.risks,
    decisions: leadOwnedDecisions,
  });
}

export class ReportSectionsService {
  private readonly logger = createAppLogger({
    service: "ReportSectionsService",
    logDir: process.env["LOG_DIR"],
    minLevel:
      (process.env["LOG_LEVEL"] as "debug" | "info" | "warn" | "error") ??
      "info",
  });

  constructor(
    private readonly repository: ReportSectionsRepository,
    // UFB-049 / Phase 50-B: optional grace-period settings provider.
    // When wired, submitSection enforces:
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
   * UFB-049 / Phase 50-B: deadline gate for submitSection. Returns the
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
    const graceMs = settings.gracePeriodHours * 3_600_000;
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

    const saved = await this.repository.saveSection(
      mergeSection(section, parsedInput, "draft"),
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

    // UFB-049 / Phase 50-B: deadline gate runs BEFORE the content
    // validator so a past-deadline submission with !allowLateSubmissions
    // returns 403 even when the payload is otherwise valid. Conversely
    // a payload with missing traffic-lights still fails on the content
    // check first when within grace window — UX wants the most-specific
    // error, and "you forgot a traffic light" beats "you're late" when
    // both are true.
    const late = await this.evaluateDeadlineGate(section.reportId);

    const errors = validateSubmitInput(section, parsedInput);

    if (errors.length > 0) {
      const [firstError] = errors;
      // `errors.length > 0` guarantees firstError exists, but TS narrows the
      // tuple access to `T | undefined` — explicit guard satisfies strict.
      if (firstError) {
        throw new ReportSectionDomainError(firstError.code, firstError.message);
      }
    }

    const saved = await this.repository.saveSection(
      mergeSection(section, parsedInput, "submitted", late),
    );

    // Phase 52-A (UFB-054): product telemetry. We always bump the
    // submission counter, labelled by the same `late` flag persisted on
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
          const deltaSeconds = (Date.now() - meta.deadline.getTime()) / 1000;
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
