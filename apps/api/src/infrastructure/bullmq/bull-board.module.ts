import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import { readRequestCookie } from "../../lib/request-boundary.js";
import { SessionRevocationService } from "../../modules/admin/index.js";
import { createAuthController } from "../../modules/auth/index.js";
import { isUserAccessBarred } from "../../modules/auth/index.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "../prisma/prisma.service";
import { QueueRegistry } from "./queue-registry.js";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

interface RequireHeadDeps {
  verifySessionToken: (token: string) => UserSession;
  prisma: PrismaService;
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
  sessionCookieName: string;
}

// Only token-verification failure means "invalid session" (401). A rejected
// isUserAccessBarred read is a server fault and must propagate to the 500
// path, never masquerade as a bad session.
function readGuardSession(
  deps: RequireHeadDeps,
  token: string,
): { ok: true; session: UserSession } | { ok: false } {
  try {
    return { ok: true, session: deps.verifySessionToken(token) };
  } catch {
    return { ok: false };
  }
}

// Re-check revoked/deactivated via isUserAccessBarred so a deactivated head
// loses queue admin immediately (not for the JWT TTL). Express 5 awaits async
// handlers; a rejected Prisma read propagates to the error handler as a 500.
export function createRequireHeadGuard(deps: RequireHeadDeps): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Read the cookie under the same resolved name the set/clear/read paths use
    // (uses the shared canonical cookie name), finishing the cookie-name dedup.
    const token = readRequestCookie(req, deps.sessionCookieName);

    if (!token) {
      res.status(HTTP_UNAUTHORIZED).json({ error: "Authentication required" });
      return;
    }

    const verified = readGuardSession(deps, token);
    if (!verified.ok) {
      res.status(HTTP_UNAUTHORIZED).json({ error: "Invalid session" });
      return;
    }

    if (verified.session.role !== "head") {
      res.status(HTTP_FORBIDDEN).json({ error: "Head role required" });
      return;
    }

    if (
      await isUserAccessBarred(
        verified.session.userId,
        deps.prisma,
        deps.sessionRevocation,
      )
    ) {
      res.status(HTTP_UNAUTHORIZED).json({ error: "Session no longer valid" });
      return;
    }

    next();
  };
}

export function mountBullBoard(app: INestApplication, env: EnvConfig): void {
  const registry = app.get(QueueRegistry);
  const pdfQueue = registry.get("pdf-export");
  const emailQueue = registry.get("email-reminder");

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(pdfQueue), new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const authController = createAuthController(env);

  // DI-managed singletons (non-strict, app-wide): Prisma is @Global and
  // SessionRevocationService is from AdminModule — reusing them keeps
  // onModuleDestroy intact; `new` would leak an unmanaged ioredis client.
  const requireHead = createRequireHeadGuard({
    verifySessionToken: (token) => authController.verifySessionToken(token),
    prisma: app.get(PrismaService),
    sessionRevocation: app.get(SessionRevocationService),
    sessionCookieName: AUTH_COOKIE_NAME,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  // @bull-board/express types getRouter() loosely (any); it is an Express router
  // at runtime, so narrow it to RequestHandler for the typed `use` overload.
  const queuesRouter = serverAdapter.getRouter() as RequestHandler;
  expressApp.use("/admin/queues", requireHead, queuesRouter);
}
