import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import { resolveSessionCookieName } from "../../lib/session-cookie";
import { SessionRevocationService } from "../../modules/admin/index.js";
import { createAuthController } from "../../modules/auth/index.js";
import { isUserAccessBarred } from "../../modules/auth/index.js";
import { PrismaService } from "../prisma/prisma.service";
import { QueueRegistry } from "./queue-registry.js";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

interface RequireHeadDeps {
  verifySessionToken: (token: string) => UserSession;
  prisma: PrismaService;
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
}

// Re-check revoked/deactivated via isUserAccessBarred so a deactivated head
// loses queue admin immediately (not for the JWT TTL). Express 5 awaits async
// handlers; try/catch maps a thrown verify or rejected Prisma read to 401.
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
      string | undefined;

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

export function mountBullBoard(app: INestApplication): void {
  const registry = app.get(QueueRegistry);
  const pdfQueue = registry.get("pdf-export");
  const emailQueue = registry.get("email-reminder");

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(pdfQueue), new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const authController = createAuthController(process.env);

  // DI-managed singletons (non-strict, app-wide): Prisma is @Global and
  // SessionRevocationService is from AdminModule — reusing them keeps
  // onModuleDestroy intact; `new` would leak an unmanaged ioredis client.
  const requireHead = createRequireHeadGuard({
    verifySessionToken: (token) => authController.verifySessionToken(token),
    prisma: app.get(PrismaService),
    sessionRevocation: app.get(SessionRevocationService),
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  // @bull-board/express types getRouter() loosely (any); it is an Express router
  // at runtime, so narrow it to RequestHandler for the typed `use` overload.
  const queuesRouter = serverAdapter.getRouter() as RequestHandler;
  expressApp.use("/admin/queues", requireHead, queuesRouter);
}
