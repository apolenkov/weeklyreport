import type { PrismaClient } from "@prisma/client";

import type { AppLogger } from "../../lib/logger";
import { ensureLeadSection } from "../report-sections/ensure-lead-section";
import {
  CarryOverDomainError,
  type CarryOverRepository,
  type CarryOverService,
} from "./carry-over.service";

/**
 * lead-report-surface-polish (HF10, design D4): automatic carry-over runs when
 * a period becomes OPEN — never for a `scheduled` period, whose source is
 * still being edited and whose `(source, target)` dedupe key must not be
 * burned early. Three call sites share this orchestrator: the login
 * provisioning path, the scheduler's per-tick reconcile loop, and the manual
 * admin create. All of them rely on it being best-effort: it NEVER rejects,
 * so a carry failure cannot abort a login, a scheduler tick, or a period
 * create. Retry comes for free from the callers re-entering it (every login,
 * every daily tick) against the cheap execution-dedupe short-circuit.
 */
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
  | "reportSection"
  | "project"
  | "projectStatus"
  | "projectActivityLead"
  | "activityStatus"
>;

/**
 * Real-dependency wiring shared by the composition root and the scheduler.
 * Roster = distinct authors of the prior period's sections, filtered to
 * still-active users — a deactivated lead never logged in under the manual
 * flow, so their target section never existed and nothing was carried; the
 * filter preserves those effective semantics. Section materialization reuses
 * `ensureLeadSection` so carried sections get the same seeded
 * ProjectStatus/ActivityStatus rows a login-provisioned section gets.
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
