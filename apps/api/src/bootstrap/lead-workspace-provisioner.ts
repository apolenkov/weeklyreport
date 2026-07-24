import type { INestApplication } from "@nestjs/common";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { SnapshotAdminService } from "../modules/admin/index.js";
import type { ProvisionLeadWorkspace } from "../modules/auth/index.js";
import { ensureCurrentPeriod } from "../modules/period/index.js";
import { PolicyApplicatorService } from "../modules/reminders/index.js";
import { ensureLeadSection } from "../modules/report-sections/index.js";

// The auth module delegates lead-workspace provisioning to the period +
// report-section domains, composed here in the composition root. Settings are
// read PER CALL so admin changes propagate to newly-created periods.
export function createProvisionLeadWorkspace(deps: {
  app: INestApplication;
  prisma: PrismaService;
  autoCarryOver: (targetReportId: string) => Promise<void>;
}): ProvisionLeadWorkspace {
  const { app, prisma, autoCarryOver } = deps;
  const policyApplicator = app.get(PolicyApplicatorService);
  const snapshotAdminService = app.get(SnapshotAdminService);
  return async (userId) => {
    const settings = await snapshotAdminService.getSettings();
    const now = new Date();
    const { reportId } = await ensureCurrentPeriod(
      prisma,
      now,
      now,
      settings,
      policyApplicator,
    );
    const { sectionId } = await ensureLeadSection(prisma, reportId, userId);
    // Unconditional, not gated on "just created": the execution-dedupe
    // short-circuit makes an already-carried period a single indexed read, so
    // every login doubles as a free retry. Never rejects — a carry problem
    // must not block login.
    await autoCarryOver(reportId);
    return { reportId, sectionId };
  };
}
