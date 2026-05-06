import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submitSectionSchema,
  validateSubmitInput,
  type DraftSavePayload,
  type DraftSaveValidationError,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

export class ReportSectionDomainError extends Error {
  constructor(
    readonly code: DraftSaveValidationError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'ReportSectionDomainError';
  }
}

export interface ReportSectionsRepository {
  getSectionById(reportSectionId: string): Promise<ReportSectionReadModel | null>;
  getReportStatus(reportId: string): Promise<string | null>;
  saveSection(section: ReportSectionReadModel): Promise<ReportSectionReadModel>;
}

function mergeSection(
  section: ReportSectionReadModel,
  input: DraftSavePayload | SubmitSectionPayload,
  nextStatus: 'draft' | 'submitted',
): ReportSectionReadModel {
  return reportSectionReadModelSchema.parse({
    ...section,
    status: nextStatus,
    submittedAt: nextStatus === 'submitted' ? new Date() : section.submittedAt,
    projects: section.projects.map((project) => ({
      ...project,
      trafficLight:
        input.projectStatuses.find((status) => status.projectId === project.projectId)
          ?.status ?? null,
    })),
    items: input.items,
    risks: input.risks,
    decisions: input.decisions,
    priorities: input.priorities,
  });
}

export class ReportSectionsService {
  constructor(private readonly repository: ReportSectionsRepository) {}

  async getActiveSection(reportSectionId: string): Promise<ReportSectionReadModel> {
    const section = await this.repository.getSectionById(reportSectionId);

    if (!section) {
      throw new Error(`Report section ${reportSectionId} was not found.`);
    }

    return reportSectionReadModelSchema.parse(section);
  }

  async saveDraft(input: DraftSavePayload): Promise<ReportSectionReadModel> {
    const parsedInput = draftSaveSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);

    const reportStatus = await this.repository.getReportStatus(section.reportId);

    if (reportStatus === 'published') {
      throw new ReportSectionDomainError(
        'SECTION_ALREADY_SUBMITTED',
        'Cannot edit sections of a published report.',
      );
    }

    if (section.status === 'submitted') {
      throw new ReportSectionDomainError(
        'SECTION_ALREADY_SUBMITTED',
        'Submitted sections are read-only.',
      );
    }

    return this.repository.saveSection(mergeSection(section, parsedInput, 'draft'));
  }

  async submitSection(input: SubmitSectionPayload): Promise<ReportSectionReadModel> {
    const parsedInput = submitSectionSchema.parse(input);
    const section = await this.getActiveSection(parsedInput.reportSectionId);
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
      mergeSection(section, parsedInput, 'submitted'),
    );
  }
}
