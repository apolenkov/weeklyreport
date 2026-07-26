import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { INestApplication } from "@nestjs/common";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { Express, RequestHandler } from "express";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import { TRPC_MAX_BODY_BYTES } from "../infrastructure/http/ingress-limits";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createContextFactory } from "../infrastructure/trpc/trpc.context";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import type { AppLogger } from "../lib/logger";
import { SessionRevocationService } from "../modules/admin/index.js";
import { createAuthController } from "../modules/auth/index.js";
import { createPdfDownloadHandler } from "../modules/pdf-export/index.js";
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
  } = deps;

  // Same-origin /pdfs/{jobId}.pdf so the session cookie rides; handler authorizes
  // against the bound report — no unauthenticated path to the bytes.
  const pdfDir = resolve(env.PDF_OUTPUT_DIR);
  mkdirSync(pdfDir, { recursive: true });
  const pdfAuthController = createAuthController(process.env);
  expressApp.get(
    PDF_DOWNLOAD_ROUTE,
    createPdfDownloadHandler({
      prisma,
      pdfDir,
      verifySessionToken: (token) =>
        pdfAuthController.verifySessionToken(token),
      sessionRevocation: app.get(SessionRevocationService),
    }),
  );
  logger.info("mounted authenticated PDF download handler", {
    route: PDF_DOWNLOAD_ROUTE,
    pdfDir,
  });

  // `maxBodySize` bounds the tRPC ingress with an explicit, auditable cap so an
  // oversized mutation body is rejected with 413 before the procedure runs.
  expressApp.use(
    "/trpc",
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app, logger),
      maxBodySize: TRPC_MAX_BODY_BYTES,
    }),
  );

  // Bound the public, unauthenticated web-vitals beacon. Registered before
  // app.listen so it runs ahead of the Nest controller handling the beacon.
  expressApp.use("/api/web-vitals", vitalsLimiter);
}
