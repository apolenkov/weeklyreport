import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { UserSession } from "@customreport/shared";
import type { INestApplication, OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import { resolveSessionCookieName } from "../../lib/session-cookie";
import { SessionRevocationService } from "../../modules/admin/session-revocation.service";
import { createAuthController } from "../../modules/auth/auth.controller";
import { isUserAccessBarred } from "../../modules/auth/session-deactivation";
import type { EnvConfig } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { getBullMQOptions } from "./bullmq-options";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

/**
 * Owns the two `Queue` instances Bull Board reads from. Created directly
 * (bypassing @nestjs/bullmq DI) to avoid the DiscoveryService bug in
 * @nestjs/bullmq 11 + NestJS 11, but registered as a Nest provider so its
 * `onModuleDestroy` closes both handles on shutdown instead of leaking their
 * Redis connections.
 */
@Injectable()
export class BullBoardQueues implements OnModuleDestroy {
  // Created in the constructor (not as field initializers) because an ES2022
  // class-field initializer cannot read the injected `env` constructor param.
  readonly pdfQueue: Queue;
  readonly emailQueue: Queue;

  constructor(env: EnvConfig) {
    this.pdfQueue = new Queue("pdf-export", getBullMQOptions(env));
    this.emailQueue = new Queue("email-reminder", getBullMQOptions(env));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pdfQueue.close(), this.emailQueue.close()]);
  }
}

interface RequireHeadDeps {
  verifySessionToken: (token: string) => UserSession;
  prisma: PrismaService;
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
}

/**
 * Express guard for /admin/queues: verify the session JWT, require the `head`
 * role, then re-check the user's revoked/deactivated state through the shared
 * `isUserAccessBarred` helper so a deactivated head loses queue admin
 * immediately rather than for the JWT's TTL.
 *
 * Express 5 awaits async handlers and forwards rejections, so the try/catch
 * still maps a thrown verify (or a rejected Prisma read) to 401.
 */
export function createRequireHeadGuard(deps: RequireHeadDeps): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Read the cookie under the same resolved name the set/clear/read paths use
    // (honours AUTH_JWT_COOKIE_NAME), finishing the cookie-name dedup.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.cookies is populated by cookie-parser at runtime; the optional chain guards the unmounted-middleware case
    const token = req.cookies?.[resolveSessionCookieName(process.env)] as
      | string
      | undefined;

    if (!token) {
      res.status(HTTP_UNAUTHORIZED).json({ error: "Authentication required" });
      return;
    }

    try {
      const session = deps.verifySessionToken(token);

      if (session.role !== "head") {
        res.status(HTTP_FORBIDDEN).json({ error: "Head role required" });
        return;
      }

      if (
        await isUserAccessBarred(
          session.userId,
          deps.prisma,
          deps.sessionRevocation,
        )
      ) {
        res
          .status(HTTP_UNAUTHORIZED)
          .json({ error: "Session no longer valid" });
        return;
      }

      next();
    } catch {
      res.status(HTTP_UNAUTHORIZED).json({ error: "Invalid session" });
    }
  };
}

/**
 * Mount Bull Board monitoring UI at /admin/queues.
 *
 * Creates Queue instances directly (bypasses @nestjs/bullmq DI) to avoid
 * the DiscoveryService bug in @nestjs/bullmq 11 + NestJS 11.
 * Protected by JWT auth — only an active (non-revoked) head can access.
 */
export function mountBullBoard(_app: INestApplication): void {
  const { pdfQueue, emailQueue } = _app.get(BullBoardQueues);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(pdfQueue), new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const authController = createAuthController(process.env);

  // Resolve the DI-managed singletons (non-strict, application-wide): Prisma is
  // @Global and SessionRevocationService is provided+exported by AdminModule,
  // so reusing them here keeps the service's onModuleDestroy cleanup intact —
  // a `new` instance would leak an unmanaged ioredis client.
  const requireHead = createRequireHeadGuard({
    verifySessionToken: (token) => authController.verifySessionToken(token),
    prisma: _app.get(PrismaService),
    sessionRevocation: _app.get(SessionRevocationService),
  });

  const expressApp = _app.getHttpAdapter().getInstance() as Express;
  // @bull-board/express types getRouter() loosely (any); it is an Express router
  // at runtime, so narrow it to RequestHandler for the typed `use` overload.
  const queuesRouter = serverAdapter.getRouter() as RequestHandler;
  expressApp.use("/admin/queues", requireHead, queuesRouter);
}
