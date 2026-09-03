import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import { createSitepingHandler } from "@siteping/adapter-prisma";
import type { Request, RequestHandler, Response } from "express";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  buildSitepingWebRequest,
  type FeedbackMethod,
  forwardSitepingResponse,
  validateFeedbackBoundary,
} from "./product-feedback.http.js";
import {
  feedbackAccessFromSession,
  type ProductFeedbackRepository,
} from "./product-feedback.repository.js";
import { createScopedSitepingStore } from "./product-feedback.siteping-store.js";

const HTTP = {
  badRequest: 400,
  unauthorized: 401,
  serverError: 500,
} as const;
const AUTHENTICATION_REQUIRED = "Authentication required.";
const PRODUCT_FEEDBACK_PHASE = "product-feedback";
const MAX_FEEDBACK_ID_LENGTH = 200;

function requestedFocusId(req: Request): string | undefined {
  if (req.method !== "GET") return undefined;
  const value = req.headers["x-siteping-focus-id"];
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_FEEDBACK_ID_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(value)
    ? value
    : undefined;
}

export interface AuthenticatedSitepingHandlerDeps {
  readonly prisma: PrismaService;
  readonly repository: ProductFeedbackRepository;
  readonly verifySessionToken: HumanSessionDeps["verifySessionToken"];
  readonly sessionRevocation: HumanSessionDeps["sessionRevocation"];
  readonly frontendOrigin: string;
  readonly logger: AppLogger;
}

export interface AuthenticatedSitepingHandler {
  readonly authenticate: RequestHandler;
  readonly handle: RequestHandler;
}

function sendError(
  res: Response,
  status: number,
  error: string,
  message: string,
): void {
  res.status(status).json({ error, message });
}

function cookieToken(req: Request): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== "object" || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[AUTH_COOKIE_NAME];
  return typeof value === "string" ? value : undefined;
}

async function resolveRequestSession(
  req: Request,
  deps: AuthenticatedSitepingHandlerDeps,
): Promise<UserSession | null> {
  const token = cookieToken(req);
  if (!token) return null;
  return resolveHumanSession(token, {
    verifySessionToken: deps.verifySessionToken,
    sessionRevocation: deps.sessionRevocation,
    prisma: deps.prisma,
  });
}

async function executeSitepingRequest(
  req: Request,
  res: Response,
  session: UserSession,
  webRequest: globalThis.Request,
  deps: AuthenticatedSitepingHandlerDeps,
  allowedOrigin: string,
): Promise<void> {
  const focusFeedbackId = requestedFocusId(req);
  const store = createScopedSitepingStore({
    repository: deps.repository,
    access: feedbackAccessFromSession(session),
    logger: deps.logger,
    ...(focusFeedbackId ? { focusFeedbackId } : {}),
  });
  const handlers = createSitepingHandler({
    store,
    allowedOrigins: [allowedOrigin],
    requireAuthForDestructive: false,
    redactUnauthenticatedEmails: false,
  });
  try {
    const method = req.method as FeedbackMethod;
    const webResponse = await handlers[method](webRequest);
    await forwardSitepingResponse(webResponse, res);
  } catch (error: unknown) {
    deps.logger.error("product feedback request failed", {
      phase: PRODUCT_FEEDBACK_PHASE,
      method: req.method,
      actorId: session.userId,
      role: session.role,
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(
      res,
      HTTP.serverError,
      "server_error",
      "Feedback request failed.",
    );
  }
}

export function createAuthenticatedSitepingHandler(
  deps: AuthenticatedSitepingHandlerDeps,
): AuthenticatedSitepingHandler {
  const sessions = new WeakMap<Request, UserSession>();
  const allowedOrigin = new URL(deps.frontendOrigin).origin;

  const authenticate: RequestHandler = async (req, res, next) => {
    const rejection = validateFeedbackBoundary(req, allowedOrigin);
    if (rejection) {
      sendError(res, rejection.status, rejection.error, rejection.message);
      return;
    }
    try {
      const session = await resolveRequestSession(req, deps);
      if (session) {
        sessions.set(req, session);
        next();
        return;
      }
      sendError(
        res,
        HTTP.unauthorized,
        "unauthorized",
        AUTHENTICATION_REQUIRED,
      );
    } catch (error: unknown) {
      deps.logger.error("product feedback authentication failed", {
        phase: PRODUCT_FEEDBACK_PHASE,
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(
        res,
        HTTP.serverError,
        "server_error",
        "Unable to authenticate request.",
      );
    }
  };

  const handle: RequestHandler = async (req, res) => {
    const session = sessions.get(req);
    sessions.delete(req);
    if (!session) {
      sendError(
        res,
        HTTP.unauthorized,
        "unauthorized",
        AUTHENTICATION_REQUIRED,
      );
      return;
    }
    const webRequest = buildSitepingWebRequest(req, session);
    if (webRequest === null) {
      sendError(
        res,
        HTTP.badRequest,
        "invalid_request",
        "Invalid feedback request.",
      );
      return;
    }

    await executeSitepingRequest(
      req,
      res,
      session,
      webRequest,
      deps,
      allowedOrigin,
    );
  };

  return { authenticate, handle };
}
