import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { INestApplication } from "@nestjs/common";
import { getTRPCErrorFromUnknown } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { AUTH_COOKIE_NAME } from "@weeklyreport/shared";
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
import { NO_CORRELATION_ID, UNKNOWN_CLIENT_IP } from "../lib/actor-sentinels";
import type { AppLogger } from "../lib/logger";
import { SessionRevocationService } from "../modules/admin/index.js";
import { createAuthController } from "../modules/auth/index.js";
import { createPdfDownloadHandler } from "../modules/pdf-export/index.js";
import {
  createAuthenticatedFeedbackHandler,
  ProductFeedbackPrismaRepository,
} from "../modules/product-feedback/index.js";
import { PDF_DOWNLOAD_ROUTE } from "./http-access-log";

interface ApiIngressDeps {
  app: INestApplication;
  expressApp: Express;
  env: EnvConfig;
  logger: AppLogger;
  prisma: PrismaService;
  appRouter: AppRouter;
  trpcLimiter: RequestHandler;
  vitalsLimiter: RequestHandler;
  feedbackLimiter: RequestHandler;
}

function mountProductFeedback(
  deps: ApiIngressDeps,
  pdfAuthController: ReturnType<typeof createAuthController>,
): void {
  const { app, expressApp, env, logger, prisma, feedbackLimiter } = deps;
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
}

export function mountApiIngress(deps: ApiIngressDeps): void {
  const {
    app,
    expressApp,
    env,
    logger,
    prisma,
    appRouter,
    trpcLimiter,
    vitalsLimiter,
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

  mountProductFeedback(deps, pdfAuthController);

  const contextFactory = createContextFactory(app, logger, env);
  // `maxBodySize` bounds the tRPC ingress with an explicit, auditable cap so an
  // oversized mutation body is rejected with 413 before the procedure runs.
  expressApp.use(
    "/trpc",
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: async (opts) => {
        try {
          return await contextFactory(opts);
        } catch (error) {
          const path = opts.info.calls[0]?.path;
          logger.error("trpc context failed", {
            phase: "trpc.context",
            // CorrelationIdMiddleware normalizes this before the raw ingress.
            correlationId: opts.req.get("x-request-id") ?? NO_CORRELATION_ID,
            ip: opts.req.ip ?? UNKNOWN_CLIENT_IP,
            path:
              path && Object.hasOwn(appRouter._def.procedures, path)
                ? path
                : "unknown",
            code: getTRPCErrorFromUnknown(error).code,
          });
          throw error;
        }
      },
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
