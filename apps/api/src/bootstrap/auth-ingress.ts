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
import { createProvisionLeadWorkspace } from "./lead-workspace-provisioner";

// Auth limiter before mountAuthRoutes so every /auth/* route is covered.
// Skip /auth/dev-login: AUTH_DEV_MODE-gated, not brute-force; 5/min blocks E2E.
function mountAuthRateLimit(
  expressApp: Express,
  authLimiter: RequestHandler,
): void {
  expressApp.use("/auth", ((req, res, next) => {
    if (req.path === "/dev-login") {
      next();
      return;
    }
    return authLimiter(req, res, next);
  }) as RequestHandler);
}

// No SAML env → dev-login only (prod fence + mountAuthRoutes refuse boot if
// both off). Any SAML var present → real strategy; partial set fails via requireEnv.
function resolveSamlStrategy(logger: AppLogger) {
  if (!hasSamlEnv(process.env)) {
    logger.warn(
      "SAML env is absent — /auth/saml/* answers 503; dev-login is the only auth path",
    );
    return undefined;
  }
  return createSamlStrategy(createSamlStrategyOptions(process.env));
}

/**
 * Mount Auth Ingress.
 * @param deps - The deps argument.
 */
export function mountAuthIngress(deps: {
  app: INestApplication;
  expressApp: Express;
  logger: AppLogger;
  prisma: PrismaService;
  autoCarryOver: (targetReportId: string) => Promise<void>;
  authLimiter: RequestHandler;
}): void {
  const { app, expressApp, logger, prisma, autoCarryOver, authLimiter } = deps;

  const samlStrategy = resolveSamlStrategy(logger);
  const authCtrl = createAuthController(process.env);
  const auditLogger = createAuditLogger(logger);

  mountAuthRateLimit(expressApp, authLimiter);

  const provisionLeadWorkspace = createProvisionLeadWorkspace({
    app,
    prisma,
    autoCarryOver,
  });
  mountAuthRoutes(
    expressApp,
    samlStrategy,
    authCtrl,
    prisma,
    process.env,
    provisionLeadWorkspace,
    auditLogger,
  );
}
