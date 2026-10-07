import type { INestApplication } from "@nestjs/common";
import type { Express, RequestHandler } from "express";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createAuditLogger } from "../lib/audit-logger";
import type { AppLogger } from "../lib/logger";
import {
  createAuthController,
  createSamlStrategy,
  createSamlStrategyOptions,
  hasSamlEnv,
  mountAuthRoutes,
} from "../modules/auth/index.js";
import type { AutoCarryOverOutcome } from "../modules/carry-over/index.js";
import { createProvisionLeadWorkspace } from "./lead-workspace-provisioner";

// No SAML env → dev-login only (prod fence + mountAuthRoutes refuse boot if
// both off). Any SAML var present → real strategy; partial set fails via requireEnv.
function resolveSamlStrategy(logger: AppLogger) {
  if (!hasSamlEnv(process.env)) {
    logger.warn(
      "SAML configuration is absent — POST /auth/saml/callback answers 503; development login remains available",
    );
    return undefined;
  }
  return createSamlStrategy(createSamlStrategyOptions(process.env));
}

export function mountAuthIngress(deps: {
  app: INestApplication;
  expressApp: Express;
  logger: AppLogger;
  prisma: PrismaService;
  autoCarryOver: (targetReportId: string) => Promise<AutoCarryOverOutcome>;
  authLimiter: RequestHandler;
}): void {
  const { app, expressApp, logger, prisma, autoCarryOver, authLimiter } = deps;

  const samlStrategy = resolveSamlStrategy(logger);
  const authCtrl = createAuthController(process.env);
  const auditLogger = createAuditLogger(logger);

  expressApp.use("/auth", authLimiter);

  const provisionLeadWorkspace = createProvisionLeadWorkspace({
    app,
    prisma,
    autoCarryOver,
  });
  mountAuthRoutes(expressApp, samlStrategy, {
    authController: authCtrl,
    prisma,
    env: process.env,
    provisionLeadWorkspace,
    auditLogger,
  });
}
