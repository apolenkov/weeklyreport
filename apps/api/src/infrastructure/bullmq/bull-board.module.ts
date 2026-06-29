import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { INestApplication } from "@nestjs/common";
import { Queue } from "bullmq";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import { resolveSessionCookieName } from "../../lib/session-cookie";
import { createAuthController } from "../../modules/auth/auth.controller";
import { getBullMQOptions } from "./bullmq-options";

/**
 * Mount Bull Board monitoring UI at /admin/queues.
 *
 * Creates Queue instances directly (bypasses @nestjs/bullmq DI) to avoid
 * the DiscoveryService bug in @nestjs/bullmq 11 + NestJS 11.
 * Protected by JWT auth — only head role can access.
 */
export function mountBullBoard(_app: INestApplication): void {
  const bullOptions = getBullMQOptions();
  const pdfQueue = new Queue("pdf-export", bullOptions);
  const emailQueue = new Queue("email-reminder", bullOptions);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(pdfQueue), new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const authController = createAuthController(process.env);

  const requireHead = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    // Read the cookie under the same resolved name the set/clear/read paths use
    // (honours AUTH_JWT_COOKIE_NAME), finishing the cookie-name dedup.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.cookies is populated by cookie-parser at runtime; the optional chain guards the unmounted-middleware case
    const token = req.cookies?.[resolveSessionCookieName(process.env)] as
      | string
      | undefined;

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    try {
      const session = authController.verifySessionToken(token);

      if (session.role !== "head") {
        res.status(403).json({ error: "Head role required" });
        return;
      }

      next();
    } catch {
      res.status(401).json({ error: "Invalid session" });
    }
  };

  const expressApp = _app.getHttpAdapter().getInstance() as Express;
  // @bull-board/express types getRouter() loosely (any); it is an Express router
  // at runtime, so narrow it to RequestHandler for the typed `use` overload.
  const queuesRouter = serverAdapter.getRouter() as RequestHandler;
  expressApp.use("/admin/queues", requireHead, queuesRouter);
}
