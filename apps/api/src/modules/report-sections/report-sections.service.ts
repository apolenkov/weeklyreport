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
  saveSection(section: ReportSectionReadModel): Promise<ReportSectionReadModel>;
}

function mergeSection(
  section: ReportSectionReadModel,
  input: DraftSavePayload | SubmitSectionPayload,
  nextStatus: "draft" | "submitted",
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

  return reportSectionReadModelSchema.parse({
    ...section,
    status: nextStatus,
    submittedAt: nextStatus === "submitted" ? new Date() : section.submittedAt,
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
    decisions: input.decisions,
    priorities: input.priorities,
  });
}

export class ReportSectionsService {
  constructor(private readonly repository: ReportSectionsRepository) {}

  private assertCanEditSection(
    section: ReportSectionReadModel,
    actorUserId?: string,
  ): void {
    if (actorUserId && section.authorId !== actorUserId) {
      throw new ReportSectionAccessError("Can only edit your own section.");
    }
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

    return this.repository.saveSection(
      mergeSection(section, parsedInput, "draft"),
    );
  }

  async submitSection(
    input: SubmitSectionPayload,
    actorUserId?: string,
  ): Promise<ReportSectionReadModel> {
    const parsedInput = submitSectionSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
    this.assertCanEditSection(section, actorUserId);
    const errors = validateSubmitInput(section, parsedInput);

    if (errors.length > 0) {
      const [firstError] = errors;
      // `errors.length > 0` guarantees firstError exists, but TS narrows the
      // tuple access to `T | undefined` — explicit guard satisfies strict.
      if (firstError) {
        throw new ReportSectionDomainError(firstError.code, firstError.message);
      }
    }

    return this.repository.saveSection(
      mergeSection(section, parsedInput, "submitted"),
    );
  }
}
