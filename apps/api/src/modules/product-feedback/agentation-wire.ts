import {
  agentationActionSchema,
  agentationAnnotationCreateSchema,
  agentationAnnotationPatchSchema,
  agentationSessionCreateSchema,
  agentationThreadSchema,
  normalizeAgentationPath,
  type UserSession,
} from "@weeklyreport/shared";
import type { Request, Response } from "express";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AgentationPrismaRepository,
  type AgentationRole,
} from "./agentation.repository.js";
import {
  getAgentationSseConnectionCounts,
  startAgentationSse,
} from "./agentation-sse.js";
import { feedbackAccessFromSession } from "./product-feedback.repository.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

interface AgentationRequestOptions {
  readonly actor?: AgentationRole;
  readonly isAgent?: boolean;
  readonly frontendOrigin?: string;
}
type ResolvedOptions = Required<
  Pick<AgentationRequestOptions, "actor" | "isAgent">
> &
  Pick<AgentationRequestOptions, "frontendOrigin">;
type FeedbackAccess = ReturnType<typeof feedbackAccessFromSession>;

interface AgentationRequestDeps {
  readonly prisma: PrismaService;
  readonly logger: AppLogger;
  readonly options?: AgentationRequestOptions | AgentationRole;
}

interface AgentationRouteContext {
  readonly repo: AgentationPrismaRepository;
  readonly access: FeedbackAccess;
  readonly path: string;
  readonly options: ResolvedOptions;
}

function send(res: Response, status: number, body: unknown): void {
  res.status(status).json(body);
}
function missing(res: Response): true {
  send(res, HTTP_NOT_FOUND, { error: "Not found" });
  return true;
}
function resolveOptions(
  value: AgentationRequestOptions | AgentationRole,
): ResolvedOptions {
  if (typeof value === "string")
    return { actor: value, isAgent: value === "agent" };
  const isAgent = value.isAgent ?? value.actor === "agent";
  const resolved: ResolvedOptions = {
    actor: value.actor ?? (isAgent ? "agent" : "human"),
    isAgent,
  };
  return value.frontendOrigin
    ? { ...resolved, frontendOrigin: value.frontendOrigin }
    : resolved;
}
function requestsAgentSync(req: Request, options: ResolvedOptions): boolean {
  return options.isAgent && req.query.agent === "true";
}
async function events(
  req: Request,
  res: Response,
  context: AgentationRouteContext,
  sessionId: string | undefined,
): Promise<true> {
  const { repo, access, options } = context;
  if (!sessionId && !options.isAgent) {
    send(res, HTTP_FORBIDDEN, {
      error: "Global Agentation stream is disabled.",
    });
    return true;
  }
  if (sessionId && !(await repo.getSession(access, sessionId)))
    return missing(res);
  const sseOptions = {
    req,
    res,
    agent: requestsAgentSync(req, options),
    allowGlobal: options.isAgent,
    source: {
      loadEvents: (after: bigint, id?: string) =>
        repo.events(access, after, id),
      loadPending: (id?: string) => repo.pending(access, id),
      loadLatestSequence: (id?: string) => repo.latestEventSequence(access, id),
      loadDeletionEvents: (
        id: string,
        after: bigint,
        through: bigint,
        limit: number,
      ) => repo.deletionEvents(access, id, { after, through, limit }),
    },
    ...(sessionId ? { scopedSessionId: sessionId } : {}),
    ...(options.frontendOrigin
      ? { expectedFrontendOrigin: options.frontendOrigin }
      : {}),
  };
  await startAgentationSse(sseOptions);
  return true;
}
async function collection(
  req: Request,
  res: Response,
  context: AgentationRouteContext,
): Promise<boolean> {
  const { repo, access, path } = context;
  switch (`${req.method} ${path}`) {
    case "GET /health":
      send(res, HTTP_OK, { status: "ok", mode: "postgres" });
      return true;
    case "GET /status":
      send(res, HTTP_OK, {
        mode: "postgres",
        webhooksConfigured: false,
        webhookCount: 0,
        ...getAgentationSseConnectionCounts(),
      });
      return true;
    case "POST /sessions": {
      const input = agentationSessionCreateSchema.parse(req.body);
      send(res, HTTP_CREATED, await repo.createSession(access, input));
      return true;
    }
    case "GET /sessions":
      send(res, HTTP_OK, await repo.listSessions(access));
      return true;
    case "GET /pending": {
      const rows = await repo.pending(access);
      send(res, HTTP_OK, { count: rows.length, annotations: rows });
      return true;
    }
    case "GET /events":
      return events(req, res, context, undefined);
    default:
      return false;
  }
}
async function sessionRoute(
  req: Request,
  res: Response,
  context: AgentationRouteContext,
  id: string,
): Promise<boolean> {
  const { repo, access, path, options } = context;
  switch (`${req.method} ${path}`) {
    case `GET /sessions/${id}`: {
      const row = await repo.getSession(access, id);
      return row ? (send(res, HTTP_OK, row), true) : missing(res);
    }
    case `GET /sessions/${id}/pending`: {
      if (!(await repo.getSession(access, id))) return missing(res);
      const rows = await repo.pending(access, id);
      send(res, HTTP_OK, { count: rows.length, annotations: rows });
      return true;
    }
    case `POST /sessions/${id}/annotations`: {
      const row = await repo.addAnnotation(
        access,
        id,
        agentationAnnotationCreateSchema.parse(req.body),
      );
      return row ? (send(res, HTTP_CREATED, row), true) : missing(res);
    }
    case `POST /sessions/${id}/action`: {
      const count = await repo.action(
        access,
        id,
        agentationActionSchema.parse(req.body),
        options.actor,
      );
      if (count === null) return missing(res);
      const listeners = getAgentationSseConnectionCounts().agentListeners;
      send(res, HTTP_OK, {
        success: true,
        annotationCount: count,
        delivered: {
          sseListeners: listeners,
          webhooks: 0,
          total: listeners,
        },
      });
      return true;
    }
    case `GET /sessions/${id}/events`:
      return events(req, res, context, id);
    default:
      return false;
  }
}
async function annotationRoute(
  req: Request,
  res: Response,
  context: AgentationRouteContext,
  id: string,
): Promise<boolean> {
  const { repo, access, path, options } = context;
  switch (`${req.method} ${path}`) {
    case `GET /annotations/${id}`: {
      const row = await repo.getAnnotation(access, id);
      return row ? (send(res, HTTP_OK, row), true) : missing(res);
    }
    case `PATCH /annotations/${id}`:
      return patchAnnotation(req, res, context, id);
    case `DELETE /annotations/${id}`: {
      const row = await repo.updateAnnotation(
        access,
        id,
        { status: "dismissed" },
        { role: options.actor, source: "native-delete" },
      );
      if (!row) return missing(res);
      send(res, HTTP_OK, { deleted: true, annotationId: id });
      return true;
    }
    case `POST /annotations/${id}/thread`: {
      const row = await repo.addThreadMessage(
        access,
        id,
        agentationThreadSchema.parse(req.body),
        options.actor,
      );
      return row ? (send(res, HTTP_CREATED, row), true) : missing(res);
    }
    default:
      return false;
  }
}

async function patchAnnotation(
  req: Request,
  res: Response,
  context: AgentationRouteContext,
  id: string,
): Promise<boolean> {
  const { repo, access, options } = context;
  const patch = agentationAnnotationPatchSchema.parse(req.body);
  if (options.actor === "human" && patch.status === "dismissed") {
    send(res, HTTP_BAD_REQUEST, { error: "dismiss_reason_required" });
    return true;
  }
  const row = await repo.updateAnnotation(access, id, patch, {
    role: options.actor,
  });
  return row ? (send(res, HTTP_OK, row), true) : missing(res);
}

export async function executeAgentationRequest(
  req: Request,
  res: Response,
  session: UserSession,
  { prisma, logger, options: actorOrOptions = "human" }: AgentationRequestDeps,
): Promise<boolean> {
  const options = resolveOptions(actorOrOptions);
  // The handler is mounted at /api/v1 for both /feedback and /agentation —
  // without this guard, un-prefixed paths like /api/v1/sessions would shadow
  // onto agentation handlers below.
  if (!/^\/agentation(?=\/|$)/.test(req.path)) return false;
  const path = req.path.replace(/^\/agentation(?=\/|$)/, "") || "/";
  res.setHeader("cache-control", "no-store");
  const repo = new AgentationPrismaRepository(prisma);
  const context: AgentationRouteContext = {
    repo,
    access: feedbackAccessFromSession(session),
    path,
    options,
  };
  if (await collection(req, res, context)) return true;
  const sessionId = /^\/sessions\/([^/]+)(?:\/|$)/.exec(path)?.[1];
  if (sessionId && (await sessionRoute(req, res, context, sessionId)))
    return true;
  const annotationId = /^\/annotations\/([^/]+)(?:\/|$)/.exec(path)?.[1];
  if (annotationId && (await annotationRoute(req, res, context, annotationId)))
    return true;
  logger.debug("unhandled Agentation route", {
    path,
    method: req.method,
    actorId: options.isAgent ? "agent" : session.userId,
  });
  return false;
}

export { normalizeAgentationPath };
