import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  FeedbackInvalidStatusError,
  FeedbackNotFoundError,
  type ProductFeedbackRepository,
} from "./product-feedback.repository.js";
import type { FeedbackRouteDeps } from "./product-feedback.routes.js";
import {
  executeFeedbackRequest,
  type FeedbackRequestPrincipal,
} from "./product-feedback-request.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const LOG_PHASE = "product-feedback";
const AGENTATION_AGENT_ID = "00000000-0000-4000-8000-000000000001";
const IPV4_ADDRESS_FAMILY = 4;
const IPV4_MAPPED_PREFIX = "::ffff:";

export interface AuthenticatedFeedbackHandlerDeps extends FeedbackRouteDeps {
  readonly prisma: PrismaService;
  readonly repository: ProductFeedbackRepository;
  readonly verifySessionToken: HumanSessionDeps["verifySessionToken"];
  readonly sessionRevocation: HumanSessionDeps["sessionRevocation"];
  readonly frontendOrigin: string;
  readonly logger: AppLogger;
  readonly agentationApiKey?: string;
  readonly agentationEnabled?: boolean;
}

export interface AuthenticatedFeedbackHandler {
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

function validAgentKey(req: Request, expected?: string): boolean {
  const supplied = req.header("x-api-key");
  if (!expected || !supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  if (address === "::1") return true;
  const ipv4 = address.startsWith(IPV4_MAPPED_PREFIX)
    ? address.slice(IPV4_MAPPED_PREFIX.length)
    : address;
  return isIP(ipv4) === IPV4_ADDRESS_FAMILY && ipv4.startsWith("127.");
}

function agentPathAllowed(req: Request): boolean {
  if (req.method === "GET")
    return req.path.startsWith("/agentation/") || req.path === "/agentation";
  return (
    (req.method === "PATCH" &&
      /^\/agentation\/annotations\/[^/]+$/.test(req.path)) ||
    (req.method === "POST" &&
      (/^\/agentation\/annotations\/[^/]+\/thread$/.test(req.path) ||
        /^\/agentation\/sessions\/[^/]+\/action$/.test(req.path)))
  );
}
function agentSession(): UserSession {
  return {
    userId: AGENTATION_AGENT_ID,
    email: "agentation@local",
    name: "Agentation agent",
    role: "admin",
  };
}

async function resolveRequestSession(
  req: Request,
  deps: AuthenticatedFeedbackHandlerDeps,
): Promise<UserSession | null> {
  const token = cookieToken(req);
  if (!token) return null;
  return resolveHumanSession(token, {
    verifySessionToken: deps.verifySessionToken,
    sessionRevocation: deps.sessionRevocation,
    prisma: deps.prisma,
  });
}

function allowedRequest(req: Request, frontendOrigin: string): boolean {
  const expectedOrigin = new URL(frontendOrigin).origin;
  const suppliedOrigin = req.header("origin");
  if (req.method === "GET" || req.method === "HEAD")
    return suppliedOrigin === undefined || suppliedOrigin === expectedOrigin;
  return suppliedOrigin === expectedOrigin;
}

function invalidRequest(error: unknown): boolean {
  return (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    error instanceof FeedbackInvalidStatusError
  );
}

/** Resolves the cookie session, answering the request itself on failure. */
async function authenticateHumanSession(
  req: Request,
  res: Response,
  deps: AuthenticatedFeedbackHandlerDeps,
): Promise<UserSession | null> {
  try {
    const session = await resolveRequestSession(req, deps);
    if (!session) {
      sendError(
        res,
        HTTP_UNAUTHORIZED,
        "unauthorized",
        "Authentication required.",
      );
    }
    return session;
  } catch (error: unknown) {
    deps.logger.error("product feedback authentication failed", {
      phase: LOG_PHASE,
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(
      res,
      HTTP_SERVER_ERROR,
      "server_error",
      "Unable to authenticate request.",
    );
    return null;
  }
}

function respondToFeedbackFailure({
  req,
  res,
  session,
  error,
  logger,
}: {
  req: Request;
  res: Response;
  session: UserSession;
  error: unknown;
  logger: AuthenticatedFeedbackHandlerDeps["logger"];
}): void {
  if (error instanceof FeedbackNotFoundError) {
    sendError(res, HTTP_NOT_FOUND, "not_found", "Feedback not found.");
    return;
  }
  if (invalidRequest(error)) {
    sendError(
      res,
      HTTP_BAD_REQUEST,
      "invalid_request",
      "Invalid feedback request.",
    );
    return;
  }
  logger.error("product feedback request failed", {
    phase: LOG_PHASE,
    method: req.method,
    actorId: session.userId,
    role: session.role,
    error: error instanceof Error ? error.message : String(error),
  });
  sendError(res, HTTP_SERVER_ERROR, "server_error", "Feedback request failed.");
}

export function createAuthenticatedFeedbackHandler(
  deps: AuthenticatedFeedbackHandlerDeps,
): AuthenticatedFeedbackHandler {
  const principals = new WeakMap<Request, FeedbackRequestPrincipal>();
  const authenticate: RequestHandler = async (req, res, next) => {
    const keyedAgentRequest =
      deps.agentationEnabled &&
      validAgentKey(req, deps.agentationApiKey) &&
      agentPathAllowed(req);
    if (keyedAgentRequest && !isLoopbackAddress(req.socket.remoteAddress)) {
      sendError(
        res,
        HTTP_FORBIDDEN,
        "forbidden_agent_source",
        "Agent access is restricted to loopback.",
      );
      return;
    }
    if (keyedAgentRequest) {
      principals.set(req, {
        session: agentSession(),
        agentationAgent: true,
      });
      next();
      return;
    }
    if (!allowedRequest(req, deps.frontendOrigin)) {
      sendError(
        res,
        HTTP_FORBIDDEN,
        "forbidden_origin",
        "Request origin is not allowed.",
      );
      return;
    }
    const session = await authenticateHumanSession(req, res, deps);
    if (!session) return;
    principals.set(req, { session, agentationAgent: false });
    next();
  };

  const handle: RequestHandler = async (req, res) => {
    const principal = principals.get(req);
    principals.delete(req);
    if (!principal) {
      sendError(
        res,
        HTTP_UNAUTHORIZED,
        "unauthorized",
        "Authentication required.",
      );
      return;
    }
    const { session } = principal;
    try {
      await executeFeedbackRequest(req, res, principal, deps);
    } catch (error: unknown) {
      respondToFeedbackFailure({
        req,
        res,
        session,
        error,
        logger: deps.logger,
      });
    }
  };
  return { authenticate, handle };
}
