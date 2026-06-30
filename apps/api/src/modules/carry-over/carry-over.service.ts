import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";

export class CarryOverDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarryOverDomainError";
  }
}

/**
 * Distinct from CarryOverDomainError so the tRPC error mapper can map it to
 * CONFLICT. CarryOverDomainError is mapped class-wide to BAD_REQUEST and is
 * shared by the validation errors, so reusing it for the dedupe race would
 * either regress those responses or never reach a conflict branch.
 */
export class CarryOverConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarryOverConflictError";
  }
}

export interface CarryOverResult {
  execution: CarryOverExecution;
  records: CarryOverRecord[];
  targetSection: ReportSectionReadModel;
}

/**
 * Period-editability facts for the carry-over write guard: editable iff the
 * period is open or reopened AND not archived (the canonical
 * `computeReopenEligibility` rule). `archived` is a separate Report flag — the
 * archive path does not force `periodStatus` — so both must be read.
 */
export interface TargetReportState {
  periodStatus: "open" | "published" | "reopened";
  archived: boolean;
}

export interface CarryOverRepository {
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<CarryOverExecution | null>;
  getSourceSections(sourceReportId: string): Promise<ReportSectionReadModel[]>;
  getTargetSections(targetReportId: string): Promise<ReportSectionReadModel[]>;
  getTargetReportState(
    targetReportId: string,
  ): Promise<TargetReportState | null>;
  saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSections: ReportSectionReadModel[],
  ): Promise<CarryOverResult>;
}

function cloneCarriedItem(
  sourceReportId: string,
  targetReportId: string,
  item: ReportSectionReadModel["items"][number],
): {
  item: ReportSectionReadModel["items"][number];
  record: CarryOverRecord;
} {
  const targetItemId = crypto.randomUUID();

  return {
    // Q8 default (plan §20.5/§21.6 T-G4): the spread preserves
    // `priorityRank` across the carry-over so a lead doesn't lose ranking
    // when an unfinished next-week item lands in the new period. Reset
    // intentionally rejected — leads otherwise re-prioritize on every
    // boundary, undoing the previous week's signal.
    item: {
      ...item,
      id: targetItemId,
      type: "current",
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
      status: "completed",
      carriedAt: new Date(),
    }),
  };
}

function cloneUnresolvedDecision(
  sourceReportId: string,
  targetReportId: string,
  decision: ReportSectionReadModel["decisions"][number],
): {
  decision: ReportSectionReadModel["decisions"][number];
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
      status: "completed",
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
      throw new CarryOverDomainError(
        "Carry-over requires different source and target reports.",
      );
    }

    const dedupeKey = `${sourceReportId}:${targetReportId}`;
    const existingExecution =
      await this.repository.findExecutionByDedupeKey(dedupeKey);
    const sourceSections =
      await this.repository.getSourceSections(sourceReportId);
    const targetSections =
      await this.repository.getTargetSections(targetReportId);

    if (sourceSections.length === 0 || targetSections.length === 0) {
      throw new CarryOverDomainError(
        "Carry-over requires both source and target sections.",
      );
    }

    // Write-integrity guard: carry-over is the only report write path with no
    // period/section state check, so without this it could diverge the live
    // rows from a published snapshot. Editable iff the target period is open or
    // reopened AND not archived (the canonical computeReopenEligibility rule),
    // and no matched target section is already submitted (read-only). Mirrors
    // the fillFrom / saveDraft guards.
    const targetState =
      await this.repository.getTargetReportState(targetReportId);
    if (!targetState || !isTargetEditable(targetState)) {
      throw new CarryOverDomainError(
        "Carry-over requires an editable target period (open or reopened, not archived).",
      );
    }
    const matchedTargetSections = targetSections.filter((target) =>
      sourceSections.some((source) => source.authorId === target.authorId),
    );
    if (matchedTargetSections.some((target) => target.status === "submitted")) {
      throw new CarryOverDomainError(
        "Carry-over cannot overwrite a submitted target section.",
      );
    }

    // Build carried rows ONLY for source sections whose author has a target
    // section: a source-only author has nowhere to persist, so counting it
    // would inflate the execution counts and emit dangling CarryOverRecord
    // rows. Carried decisions also require a productId — the Decision row's
    // product FK is NOT-NULL, so a productless decision cannot persist and must
    // not be counted either (it would exceed the rows actually written).
    const targetByAuthor = new Map(
      targetSections.map((target) => [target.authorId, target] as const),
    );
    const carriedByAuthor = sourceSections.flatMap((sourceSection) => {
      const targetSection = targetByAuthor.get(sourceSection.authorId);
      if (!targetSection) {
        return [];
      }
      const items = sourceSection.items
        .filter((item) => item.type === "next" && !item.carriedOver)
        .map((item) => cloneCarriedItem(sourceReportId, targetReportId, item));
      const decisions = sourceSection.decisions
        .filter(
          (decision) => !decision.resolvedAt && Boolean(decision.productId),
        )
        .map((decision) =>
          cloneUnresolvedDecision(sourceReportId, targetReportId, decision),
        );
      return [{ authorId: targetSection.authorId, items, decisions }];
    });

    const allCarriedItems = carriedByAuthor.flatMap((entry) => entry.items);
    const allCarriedDecisions = carriedByAuthor.flatMap(
      (entry) => entry.decisions,
    );

    // Merge carried rows into every matched target section (not just the
    // first), so the repository persists each lead's carried items/decisions.
    const nextTargetSections = targetSections.map((targetSection) => {
      const carried = carriedByAuthor.find(
        (entry) => entry.authorId === targetSection.authorId,
      );
      if (!carried || existingExecution) {
        return targetSection;
      }
      return reportSectionReadModelSchema.parse({
        ...targetSection,
        items: [
          ...targetSection.items,
          ...carried.items.map((entry) => entry.item),
        ],
        decisions: [
          ...targetSection.decisions,
          ...carried.decisions.map((entry) => entry.decision),
        ],
      });
    });

    const execution =
      existingExecution ??
      carryOverExecutionSchema.parse({
        id: crypto.randomUUID(),
        sourceReportId,
        targetReportId,
        dedupeKey,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        carriedItemCount: allCarriedItems.length,
        carriedDecisionCount: allCarriedDecisions.length,
      });
    const records = existingExecution
      ? []
      : [
          ...allCarriedItems.map((entry) => entry.record),
          ...allCarriedDecisions.map((entry) => entry.record),
        ];

    this.logger.info("executing carry-over", {
      sourceReportId,
      targetReportId,
      sourceSections: sourceSections.length,
      carriedItems: allCarriedItems.length,
      carriedDecisions: allCarriedDecisions.length,
    });
    return this.repository.saveCarryOver(
      execution,
      records,
      nextTargetSections,
    );
  }
}

function isTargetEditable(state: TargetReportState): boolean {
  return (
    !state.archived &&
    (state.periodStatus === "open" || state.periodStatus === "reopened")
  );
}
