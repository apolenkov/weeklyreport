import {
  type CarryOverExecution,
  type CarryOverRecord,
  type CurrentPeriodLifecycle,
  type ReportSectionReadModel,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import {
  buildCarryOverExecution,
  carriedCounts,
  collectCarryOverRecords,
  mergeCarriedIntoTargets,
  planCarriedEntries,
} from "./carry-over-plan";

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
export type TargetReportState = Pick<
  CurrentPeriodLifecycle,
  | "status"
  | "periodState"
  | "periodStatus"
  | "archived"
  | "autoPublished"
  | "autoArchived"
  | "publishedAt"
  | "publishedById"
  | "reopenedAt"
>;

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

function assertNoSubmittedTarget(
  sourceSections: readonly ReportSectionReadModel[],
  targetSections: readonly ReportSectionReadModel[],
): void {
  const matchedTargetSections = targetSections.filter((target) =>
    sourceSections.some((source) => source.authorId === target.authorId),
  );
  if (matchedTargetSections.some((target) => target.status === "submitted")) {
    throw new CarryOverDomainError(
      "Carry-over cannot overwrite a submitted target section.",
    );
  }
}

function selectPlannedTargetSections(
  targetSections: readonly ReportSectionReadModel[],
  carriedByAuthor: readonly { authorId: string }[],
): ReportSectionReadModel[] {
  const plannedAuthors = new Set(
    carriedByAuthor.map((entry) => entry.authorId),
  );
  return targetSections.filter((target) => plannedAuthors.has(target.authorId));
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

  // The dedupe lookup and both section reads run before the period gate; the
  // gate still rejects a replay whose target period is no longer editable.
  private async loadCarryOverInputs(
    sourceReportId: string,
    targetReportId: string,
    dedupeKey: string,
  ): Promise<{
    existingExecution: CarryOverExecution | null;
    sourceSections: ReportSectionReadModel[];
    targetSections: ReportSectionReadModel[];
  }> {
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

    return { existingExecution, sourceSections, targetSections };
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
    const { existingExecution, sourceSections, targetSections } =
      await this.loadCarryOverInputs(sourceReportId, targetReportId, dedupeKey);
    assertNoSubmittedTarget(sourceSections, targetSections);

    // ONE lifecycle instant for the whole run, minted at the domain boundary:
    // the plan clones and the execution builder consume it and never invent
    // their own timestamps.
    const now = new Date();
    const carriedByAuthor = planCarriedEntries(
      sourceSections,
      targetSections,
      sourceReportId,
      targetReportId,
      now,
    );
    assertUniqueCarriedAuthors(carriedByAuthor);
    const counts = carriedCounts(carriedByAuthor);
    const plannedTargetSections = selectPlannedTargetSections(
      targetSections,
      carriedByAuthor,
    );

    // Replaying a completed carry-over must stay a no-op write: reuse the
    // stored execution and leave every target section as it stands.
    const nextTargetSections = existingExecution
      ? plannedTargetSections
      : mergeCarriedIntoTargets(plannedTargetSections, carriedByAuthor);
    const execution =
      existingExecution ??
      buildCarryOverExecution({
        sourceReportId,
        targetReportId,
        dedupeKey,
        carriedItemCount: counts.items,
        carriedDecisionCount: counts.decisions,
        now,
      });
    const records = existingExecution
      ? []
      : collectCarryOverRecords(carriedByAuthor);

    this.logger.info("executing carry-over", {
      sourceReportId,
      targetReportId,
      sourceSections: sourceSections.length,
      carriedItems: counts.items,
      carriedDecisions: counts.decisions,
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
    state.periodState === "open" &&
    ((state.status === "draft" && state.periodStatus === "open") ||
      (state.status === "published" && state.periodStatus === "reopened"))
  );
}
