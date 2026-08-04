import type { INestApplication } from "@nestjs/common";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppLogger } from "../lib/logger";
import {
  type AutoCarryOverOutcome,
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
  CarryOverPrismaRepository,
  CarryOverService,
} from "../modules/carry-over/index.js";

// Auto carry-over closure shared by the tRPC createPeriodManual seam and the
// login provisioning seam. Best effort by construction —
// carryOverIntoOpenedPeriod never rejects.
export function createAutoCarryOver(deps: {
  app: INestApplication;
  prisma: PrismaService;
  logger: AppLogger;
}): (targetReportId: string) => Promise<AutoCarryOverOutcome> {
  const { app, prisma, logger } = deps;
  const autoCarryOverDeps = buildAutoCarryOverDeps({
    prisma,
    repository: app.get(CarryOverPrismaRepository),
    carryOverService: app.get(CarryOverService),
    logger,
  });
  return (targetReportId: string) =>
    carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId);
}
