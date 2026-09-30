import type { INestApplication } from "@nestjs/common";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { SnapshotAdminService } from "../modules/admin/index.js";
import type { ProvisionLeadWorkspace } from "../modules/auth/index.js";
import {
  type AutoCarryOver,
  runAutoCarryOverWithRetry,
} from "../modules/carry-over/index.js";
import { ensureCurrentPeriod } from "../modules/period/index.js";
import { PolicyApplicatorService } from "../modules/reminders/index.js";
import {
  ensureLeadSection,
  ReportSectionDomainError,
  ReportSectionNotFoundError,
} from "../modules/report-sections/index.js";

const isStaleProvisionTarget = (error: unknown): boolean =>
  error instanceof ReportSectionDomainError ||
  error instanceof ReportSectionNotFoundError;

// The auth module delegates lead-workspace provisioning to the period +
// report-section domains, composed here in the composition root. Settings are
// read PER CALL so admin changes propagate to newly-created periods.
export function createProvisionLeadWorkspace(deps: {
  app: INestApplication;
  prisma: PrismaService;
  autoCarryOver: AutoCarryOver;
}): ProvisionLeadWorkspace {
  const { app, prisma, autoCarryOver } = deps;
  const policyApplicator = app.get(PolicyApplicatorService);
  const snapshotAdminService = app.get(SnapshotAdminService);
  return async (userId) => {
    const settings = await snapshotAdminService.getSettings();
    for (const attempt of [0, 1] as const) {
      const now = new Date();
      const { reportId } = await ensureCurrentPeriod(prisma, now, settings, {
        now,
        policyApplicator,
      });
      try {
        const { sectionId } = await ensureLeadSection(prisma, reportId, userId);
        // Unconditional (not "just created"): dedupe short-circuits an
        // already-carried period to one indexed read, so every login is a free
        // retry. Never rejects — a carry problem must not block login.
        await runAutoCarryOverWithRetry(autoCarryOver, reportId);
        return { reportId, sectionId };
      } catch (error) {
        // Publish/delete may win after ensureCurrentPeriod. Re-resolve once;
        // never return the stale section as a compatibility fallback.
        if (attempt === 0 && isStaleProvisionTarget(error)) continue;
        throw error;
      }
    }
    throw new Error("Lead workspace provisioning exhausted its retry.");
  };
}
