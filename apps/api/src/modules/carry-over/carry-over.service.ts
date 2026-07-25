import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  type PeriodStatus,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import { cloneCarriedItem, cloneUnresolvedDecision } from "./carry-over-clones";

export class CarryOverDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarryOverDomainError";
  }
}

// Mapped to CONFLICT; CarryOverDomainError is BAD_REQUEST class-wide.
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

// Editable iff open/reopened AND not archived (archived is a separate flag).
export interface TargetReportState {
  periodStatus: PeriodStatus;
  archived: boolean;
}

export interface CarryOverRepository {
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<CarryOverExecution | null>;
  getSourceSections(sourceReportId: string): Promise<ReportSectionReadModel[]>;
  getTargetSections(targetReportId: string): Promise<ReportSectionReadModel[]>;
  findPreviousReportId(targetReportId: string): Promise<string | null>;
  getTargetReportState(
    targetReportId: string,
  ): Promise<TargetReportState | null>;
  saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSections: ReportSectionReadModel[],
  ): Promise<CarryOverResult>;
}

// Activity-parented only if re-attached on the target; product-parented always qualifies.
function isActivityCarryable(
  activityId: string | null | undefined,
  targetActivityIds: ReadonlySet<string>,
): boolean {
  return activityId == null || targetActivityIds.has(activityId);
}

function assertUniqueCarriedAuthors(
  entries: readonly { authorId: string }[],
): void {
  const authorIds = entries.map((entry) => entry.authorId);
  const counts = authorIds.reduce(
    (map, authorId) => map.set(authorId, (map.get(authorId) ?? 0) + 1),
    new Map<string, number>(),
  );
  const duplicateAuthorId = authorIds.find(
    (authorId) => (counts.get(authorId) ?? 0) > 1,
  );
  if (duplicateAuthorId !== undefined) {
    throw new CarryOverDomainError(
      `Carry-over requires one source section per author; duplicate author ${duplicateAuthorId}.`,
    );
  }
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

    // Only write path without built-in period check — must match fillFrom/saveDraft.
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

    // Only authors with a target section; activity-parented needs re-attachment.
    const targetByAuthor = new Map(
      targetSections.map((target) => [target.authorId, target] as const),
    );
    const carriedByAuthor = sourceSections.flatMap((sourceSection) => {
      const targetSection = targetByAuthor.get(sourceSection.authorId);
      if (!targetSection) {
        return [];
      }
      // Activities re-attached to this author's target section — an
      // activity-parented source record carries only when its parent is here.
      const targetActivityIds = new Set(
        targetSection.activities.map((activity) => activity.activityId),
      );
      // Skip lineages the target already holds — keeps counts accurate and
      // avoids silent skipDuplicates / P2002 misread as dedupe race.
      const targetItemLineage = new Set(
        targetSection.items
          .map((i) => i.stableId)
          .filter((s): s is string => Boolean(s)),
      );
      const targetDecisionLineage = new Set(
        targetSection.decisions
          .map((d) => d.stableId)
          .filter((s): s is string => Boolean(s)),
      );
      const items = sourceSection.items
        .filter(
          (item) =>
            item.type === "next" &&
            !item.carriedOver &&
            // Finished work is closed; postponed work was explicitly pushed
            // beyond this period — the lead re-plans it by hand, never auto.
            item.workflowStatus !== "done" &&
            item.workflowStatus !== "postponed" &&
            isActivityCarryable(item.activityId, targetActivityIds) &&
            !(
              item.stableId !== undefined &&
              targetItemLineage.has(item.stableId)
            ),
        )
        .map((item) => cloneCarriedItem(sourceReportId, targetReportId, item));
      const decisions = sourceSection.decisions
        .filter(
          (decision) =>
            !decision.resolvedAt &&
            isActivityCarryable(decision.activityId, targetActivityIds) &&
            !(
              decision.stableId !== undefined &&
              targetDecisionLineage.has(decision.stableId)
            ),
        )
        .map((decision) =>
          cloneUnresolvedDecision(sourceReportId, targetReportId, decision),
        );
      return [{ authorId: targetSection.authorId, items, decisions }];
    });
    assertUniqueCarriedAuthors(carriedByAuthor);

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

export function isTargetEditable(state: TargetReportState): boolean {
  return (
    !state.archived &&
    (state.periodStatus === "open" || state.periodStatus === "reopened")
  );
}
