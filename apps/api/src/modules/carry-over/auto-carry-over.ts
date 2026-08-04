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
  readonly repository: Pick<
    CarryOverRepository,
    "findPreviousReportId" | "findExecutionByDedupeKey"
  >;
  readonly carryOverService: Pick<CarryOverService, "executeCarryOver">;
  // Distinct prior-period section authors who are still active users.
  readonly listActiveSourceAuthorIds: (
    sourceReportId: string,
  ) => Promise<readonly string[]>;
  // Materialize one author's target section (idempotent).
  readonly ensureSection: (
    targetReportId: string,
    authorId: string,
  ) => Promise<void>;
  readonly logger: Pick<AppLogger, "info" | "warn">;
}

// Per-period outcome of one auto carry-over run; callers can observe failures.
export type AutoCarryOverOutcome =
  | {
      readonly status: "completed";
      readonly sourceReportId: string;
      readonly targetReportId: string;
      readonly authorCount: number;
    }
  | {
      readonly status: "skipped";
      readonly targetReportId: string;
      readonly reason:
        "no-prior-period" | "execution-exists" | "no-active-authors";
    }
  | {
      readonly status: "failed";
      readonly targetReportId: string;
      // False only for unexpected faults — a benign domain rejection is expected.
      readonly expected: boolean;
      readonly reason: string;
    };

export type AutoCarryOver = (
  targetReportId: string,
) => Promise<AutoCarryOverOutcome>;

export async function runAutoCarryOverWithRetry(
  autoCarryOver: AutoCarryOver,
  targetReportId: string,
): Promise<AutoCarryOverOutcome> {
  const outcome = await autoCarryOver(targetReportId);
  if (outcome.status !== "failed" || outcome.expected) {
    return outcome;
  }
  return autoCarryOver(targetReportId);
}

export async function carryOverIntoOpenedPeriod(
  deps: AutoCarryOverDeps,
  targetReportId: string,
): Promise<AutoCarryOverOutcome> {
  try {
    return await attemptCarryOver(deps, targetReportId);
  } catch (error) {
    // Benign domain rejections (e.g. the target got published/submitted in a
    // race) are expected states, not faults; anything else is logged loudly
    // but still swallowed — no caller may be aborted by carry-over.
    const expected = error instanceof CarryOverDomainError;
    deps.logger[expected ? "info" : "warn"]("auto carry-over skipped", {
      targetReportId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "failed",
      targetReportId,
      expected,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function attemptCarryOver(
  deps: AutoCarryOverDeps,
  targetReportId: string,
): Promise<AutoCarryOverOutcome> {
  const sourceReportId =
    await deps.repository.findPreviousReportId(targetReportId);
  if (!sourceReportId) {
    // no prior period carries nothing
    return { status: "skipped", targetReportId, reason: "no-prior-period" };
  }

  // Cheap short-circuit BEFORE any section read or materialization: once a
  // carry ran for this (source, target) pair, every re-entry is one indexed
  // select.
  const existingExecution = await deps.repository.findExecutionByDedupeKey(
    `${sourceReportId}:${targetReportId}`,
  );
  if (existingExecution) {
    return { status: "skipped", targetReportId, reason: "execution-exists" };
  }

  // Zero prior sections is a silent no-op (spec scenario); returning here
  // also keeps executeCarryOver's "requires both sections" throw off the
  // auto path.
  const authorIds = await deps.listActiveSourceAuthorIds(sourceReportId);
  if (authorIds.length === 0) {
    return { status: "skipped", targetReportId, reason: "no-active-authors" };
  }

  for (const authorId of authorIds) {
    await deps.ensureSection(targetReportId, authorId);
  }

  await deps.carryOverService.executeCarryOver(sourceReportId, targetReportId);
  deps.logger.info("auto carry-over completed", {
    sourceReportId,
    targetReportId,
    authors: authorIds.length,
  });
  return {
    status: "completed",
    sourceReportId,
    targetReportId,
    authorCount: authorIds.length,
  };
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
export function buildAutoCarryOverDeps(input: {
  readonly prisma: AutoCarryOverPrisma;
  readonly repository: AutoCarryOverDeps["repository"];
  readonly carryOverService: AutoCarryOverDeps["carryOverService"];
  readonly logger: AutoCarryOverDeps["logger"];
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
