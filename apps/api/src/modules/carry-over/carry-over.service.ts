import {
  carryOverExecutionSchema,
  carryOverRecordSchema,
  reportSectionReadModelSchema,
  type CarryOverExecution,
  type CarryOverRecord,
  type ReportSectionReadModel,
} from '@customreport/shared';

import { createNullLogger, type AppLogger } from '../../lib/logger';

export class CarryOverDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarryOverDomainError';
  }
}

export type CarryOverResult = {
  execution: CarryOverExecution;
  records: CarryOverRecord[];
  targetSection: ReportSectionReadModel;
};

export interface CarryOverRepository {
  findExecutionByDedupeKey(dedupeKey: string): Promise<CarryOverExecution | null>;
  getSourceSections(sourceReportId: string): Promise<ReportSectionReadModel[]>;
  getTargetSections(targetReportId: string): Promise<ReportSectionReadModel[]>;
  saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSection: ReportSectionReadModel,
  ): Promise<CarryOverResult>;
}

function cloneCarriedItem(
  sourceReportId: string,
  targetReportId: string,
  item: ReportSectionReadModel['items'][number],
): {
  item: ReportSectionReadModel['items'][number];
  record: CarryOverRecord;
} {
  const targetItemId = crypto.randomUUID();

  return {
    item: {
      ...item,
      id: targetItemId,
      type: 'current',
      carriedOver: true,
      completed: null,
    },
    record: carryOverRecordSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      sourceItemId: item.id ?? null,
      targetItemId,
      sourceDecisionId: null,
      targetDecisionId: null,
      status: 'completed',
      carriedAt: new Date(),
    }),
  };
}

function cloneUnresolvedDecision(
  sourceReportId: string,
  targetReportId: string,
  decision: ReportSectionReadModel['decisions'][number],
): {
  decision: ReportSectionReadModel['decisions'][number];
  record: CarryOverRecord;
} {
  const targetDecisionId = crypto.randomUUID();

  return {
    decision: {
      ...decision,
      id: targetDecisionId,
      resolvedAt: null,
    },
    record: carryOverRecordSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      sourceItemId: null,
      targetItemId: null,
      sourceDecisionId: decision.id ?? null,
      targetDecisionId,
      status: 'completed',
      carriedAt: new Date(),
    }),
  };
}

export class CarryOverService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: CarryOverRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  async executeCarryOver(
    sourceReportId: string,
    targetReportId: string,
  ): Promise<CarryOverResult> {
    if (sourceReportId === targetReportId) {
      throw new CarryOverDomainError('Carry-over requires different source and target reports.');
    }

    const dedupeKey = `${sourceReportId}:${targetReportId}`;
    const existingExecution = await this.repository.findExecutionByDedupeKey(dedupeKey);
    const sourceSections = await this.repository.getSourceSections(sourceReportId);
    const targetSections = await this.repository.getTargetSections(targetReportId);

    if (sourceSections.length === 0 || targetSections.length === 0) {
      throw new CarryOverDomainError('Carry-over requires both source and target sections.');
    }

    const allCarriedItems: Array<{ item: ReportSectionReadModel['items'][number]; record: CarryOverRecord }> = [];
    const allCarriedDecisions: Array<{ decision: ReportSectionReadModel['decisions'][number]; record: CarryOverRecord }> = [];

    for (const sourceSection of sourceSections) {
      const sectionItems = sourceSection.items
        .filter((item) => item.type === 'next' && !item.carriedOver)
        .map((item) => cloneCarriedItem(sourceReportId, targetReportId, item));
      const sectionDecisions = sourceSection.decisions
        .filter((decision) => !decision.resolvedAt)
        .map((decision) => cloneUnresolvedDecision(sourceReportId, targetReportId, decision));

      allCarriedItems.push(...sectionItems);
      allCarriedDecisions.push(...sectionDecisions);
    }

    // Match carried items/decisions to target sections by authorId
    const nextTargetSections = targetSections.map((targetSection) => {
      const sourceSection = sourceSections.find((s) => s.authorId === targetSection.authorId);
      if (!sourceSection) {
        return targetSection;
      }

      const sectionCarriedItems = allCarriedItems.filter((entry) =>
        sourceSection.items.some((i) => i.id === entry.record.sourceItemId),
      );
      const sectionCarriedDecisions = allCarriedDecisions.filter((entry) =>
        sourceSection.decisions.some((d) => d.id === entry.record.sourceDecisionId),
      );

      return reportSectionReadModelSchema.parse({
        ...targetSection,
        items: existingExecution
          ? targetSection.items
          : [...targetSection.items, ...sectionCarriedItems.map((entry) => entry.item)],
        decisions: existingExecution
          ? targetSection.decisions
          : [...targetSection.decisions, ...sectionCarriedDecisions.map((entry) => entry.decision)],
      });
    });

    const execution = existingExecution ?? carryOverExecutionSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      dedupeKey,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: allCarriedItems.length,
      carriedDecisionCount: allCarriedDecisions.length,
    });
    const records = existingExecution
      ? []
      : [...allCarriedItems.map((entry) => entry.record), ...allCarriedDecisions.map((entry) => entry.record)];

    this.logger.info('executing carry-over', {
      sourceReportId,
      targetReportId,
      sourceSections: sourceSections.length,
      carriedItems: allCarriedItems.length,
      carriedDecisions: allCarriedDecisions.length,
    });
    return this.repository.saveCarryOver(execution, records, nextTargetSections.length > 0 ? nextTargetSections[0]! : targetSections[0]!);
  }
}
