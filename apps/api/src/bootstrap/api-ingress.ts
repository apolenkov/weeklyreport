import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { AUTH_COOKIE_NAME } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { Express, RequestHandler } from "express";
import express from "express";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import {
  PRODUCT_FEEDBACK_JSON_LIMIT,
  TRPC_MAX_BODY_BYTES,
  WEB_VITALS_JSON_LIMIT,
} from "../infrastructure/http/ingress-limits";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createContextFactory } from "../infrastructure/trpc/trpc.context";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import type { AppLogger } from "../lib/logger";
import { SessionRevocationService } from "../modules/admin/index.js";
import { createAuthController } from "../modules/auth/index.js";
import { createPdfDownloadHandler } from "../modules/pdf-export/index.js";
import {
  createAuthenticatedFeedbackHandler,
  ProductFeedbackPrismaRepository,
} from "../modules/product-feedback/index.js";
import { PDF_DOWNLOAD_ROUTE } from "./http-access-log";

export function mountApiIngress(deps: {
  app: INestApplication;
  expressApp: Express;
  env: EnvConfig;
  logger: AppLogger;
  prisma: PrismaService;
  appRouter: AppRouter;
  trpcLimiter: RequestHandler;
  vitalsLimiter: RequestHandler;
  feedbackLimiter: RequestHandler;
}): void {
  const {
    app,
    expressApp,
    env,
    logger,
    prisma,
    appRouter,
    trpcLimiter,
    vitalsLimiter,
    feedbackLimiter,
  } = deps;

  // Same-origin /pdfs/{jobId}.pdf so the session cookie rides; handler authorizes
  // against the bound report — no unauthenticated path to the bytes.
  const pdfDir = resolve(env.PDF_OUTPUT_DIR);
  mkdirSync(pdfDir, { recursive: true });
  // Build the verifier from validated configuration once; use the shared
  // session cookie name for artifact authentication.
  const pdfAuthController = createAuthController(env);
  expressApp.get(
    PDF_DOWNLOAD_ROUTE,
    createPdfDownloadHandler({
      prisma,
      pdfDir,
      sessionCookieName: AUTH_COOKIE_NAME,
      verifySessionToken: (token) =>
        pdfAuthController.verifySessionToken(token),
      sessionRevocation: app.get(SessionRevocationService),
      logger,
    }),
  );
  logger.info("mounted authenticated PDF download handler", {
    route: PDF_DOWNLOAD_ROUTE,
    pdfDir,
  });

  if (env.PRODUCT_FEEDBACK_ENABLED === true && env.NODE_ENV !== "production") {
    const feedbackHandler = createAuthenticatedFeedbackHandler({
      prisma,
      repository: new ProductFeedbackPrismaRepository(prisma),
      verifySessionToken: (token) =>
        pdfAuthController.verifySessionToken(token),
      sessionRevocation: app.get(SessionRevocationService),
      frontendOrigin: env.FRONTEND_URL,
      logger,
      ...(env.AGENTATION_API_KEY
        ? { agentationApiKey: env.AGENTATION_API_KEY }
        : {}),
      agentationEnabled: true,
    });
    expressApp.use(
      "/api/v1",
      feedbackLimiter,
      feedbackHandler.authenticate,
      express.json({ limit: PRODUCT_FEEDBACK_JSON_LIMIT }),
      feedbackHandler.handle,
    );
    logger.info("mounted authenticated product feedback handler", {
      route: "/api/v1/feedback and /api/v1/agentation",
    });
  }

  // `maxBodySize` bounds the tRPC ingress with an explicit, auditable cap so an
  // oversized mutation body is rejected with 413 before the procedure runs.
  expressApp.use(
    "/trpc",
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app, logger, env),
      maxBodySize: TRPC_MAX_BODY_BYTES,
    }),
  );

  // Bound the public, unauthenticated web-vitals beacon. Registered before
  // app.listen so it runs ahead of the Nest controller handling the beacon.
  expressApp.use(
    "/api/web-vitals",
    vitalsLimiter,
    express.json({ limit: WEB_VITALS_JSON_LIMIT }),
  );
}
