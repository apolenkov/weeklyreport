import type { PrismaClient } from "@prisma/client";

import type { AppLogger } from "../../lib/logger";
import { ensureLeadSection } from "../report-sections/index.js";
import {
  CarryOverDomainError,
  type CarryOverRepository,
  type CarryOverService,
} from "./carry-over.service";

// Best-effort OPEN-period carry only (never scheduled — would burn dedupe early).
// Never rejects: carry failure must not abort login, scheduler tick, or period create.
export interface AutoCarryOverDeps {
  repository: Pick<
    CarryOverRepository,
    "findPreviousReportId" | "findExecutionByDedupeKey"
  >;
  carryOverService: Pick<CarryOverService, "executeCarryOver">;
  /** Distinct prior-period section authors who are still active users. */
  listActiveSourceAuthorIds(sourceReportId: string): Promise<string[]>;
  /** Materialize one author's target section (idempotent). */
  ensureSection(targetReportId: string, authorId: string): Promise<void>;
  logger: Pick<AppLogger, "info" | "warn">;
}

/**
 * Carry Over Into Opened Period.
 * @param deps - The deps argument.
 * @param targetReportId - The targetReportId argument.
 */
export async function carryOverIntoOpenedPeriod(
  deps: AutoCarryOverDeps,
  targetReportId: string,
): Promise<void> {
  try {
    const sourceReportId =
      await deps.repository.findPreviousReportId(targetReportId);
    if (!sourceReportId) return; // no prior period carries nothing

    // Cheap short-circuit BEFORE any section read or materialization: once a
    // carry ran for this (source, target) pair, every re-entry is one indexed
    // select.
    const existingExecution = await deps.repository.findExecutionByDedupeKey(
      `${sourceReportId}:${targetReportId}`,
    );
    if (existingExecution) return;

    // Zero prior sections is a silent no-op (spec scenario); returning here
    // also keeps executeCarryOver's "requires both sections" throw off the
    // auto path.
    const authorIds = await deps.listActiveSourceAuthorIds(sourceReportId);
    if (authorIds.length === 0) return;

    for (const authorId of authorIds) {
      await deps.ensureSection(targetReportId, authorId);
    }

    await deps.carryOverService.executeCarryOver(
      sourceReportId,
      targetReportId,
    );
    deps.logger.info("auto carry-over completed", {
      sourceReportId,
      targetReportId,
      authors: authorIds.length,
    });
  } catch (error) {
    // Benign domain rejections (e.g. the target got published/submitted in a
    // race) are expected states, not faults; anything else is logged loudly
    // but still swallowed — no caller may be aborted by carry-over.
    const level = error instanceof CarryOverDomainError ? "info" : "warn";
    deps.logger[level]("auto carry-over skipped", {
      targetReportId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

type AutoCarryOverPrisma = Pick<
  PrismaClient,
  | "$transaction"
  | "reportSection"
  | "project"
  | "projectStatus"
  | "projectActivityLead"
  | "activityStatus"
>;

// Active authors only; ensureLeadSection seeds the same status rows as login provision.
/**
 * Build Auto Carry Over Deps.
 * @param input - The input argument.
 */
export function buildAutoCarryOverDeps(input: {
  prisma: AutoCarryOverPrisma;
  repository: AutoCarryOverDeps["repository"];
  carryOverService: AutoCarryOverDeps["carryOverService"];
  logger: AutoCarryOverDeps["logger"];
}): AutoCarryOverDeps {
  return {
    repository: input.repository,
    carryOverService: input.carryOverService,
    listActiveSourceAuthorIds: async (sourceReportId) => {
      const sections = await input.prisma.reportSection.findMany({
        where: { reportId: sourceReportId, author: { isActive: true } },
        select: { authorId: true },
      });
      return sections.map((section) => section.authorId);
    },
    ensureSection: async (targetReportId, authorId) => {
      await ensureLeadSection(input.prisma, targetReportId, authorId);
    },
    logger: input.logger,
  };
}
