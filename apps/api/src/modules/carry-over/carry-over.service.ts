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
  getSourceSection(sourceReportId: string): Promise<ReportSectionReadModel | null>;
  getTargetSection(targetReportId: string): Promise<ReportSectionReadModel | null>;
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
    const sourceSection = await this.repository.getSourceSection(sourceReportId);
    const targetSection = await this.repository.getTargetSection(targetReportId);

    if (!sourceSection || !targetSection) {
      throw new CarryOverDomainError('Carry-over requires both source and target sections.');
    }

    const carriedItems = sourceSection.items
      .filter((item) => item.type === 'next' && !item.carriedOver)
      .map((item) => cloneCarriedItem(sourceReportId, targetReportId, item));
    const carriedDecisions = sourceSection.decisions
      .filter((decision) => !decision.resolvedAt)
      .map((decision) => cloneUnresolvedDecision(sourceReportId, targetReportId, decision));

    const nextTargetSection = reportSectionReadModelSchema.parse({
      ...targetSection,
      items: existingExecution
        ? targetSection.items
        : [...targetSection.items, ...carriedItems.map((entry) => entry.item)],
      decisions: existingExecution
        ? targetSection.decisions
        : [...targetSection.decisions, ...carriedDecisions.map((entry) => entry.decision)],
    });

    const execution = existingExecution ?? carryOverExecutionSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      dedupeKey,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: carriedItems.length,
      carriedDecisionCount: carriedDecisions.length,
    });
    const records = existingExecution
      ? []
      : [...carriedItems.map((entry) => entry.record), ...carriedDecisions.map((entry) => entry.record)];

    this.logger.info('executing carry-over', {
      sourceReportId,
      targetReportId,
      carriedItems: carriedItems.length,
      carriedDecisions: carriedDecisions.length,
    });
    return this.repository.saveCarryOver(execution, records, nextTargetSection);
  }
}
