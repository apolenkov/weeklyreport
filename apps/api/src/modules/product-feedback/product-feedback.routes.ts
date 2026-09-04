import {
  feedbackStatusSchema,
  MAX_FEEDBACK_MESSAGE_LENGTH,
  normalizeFeedbackPath,
  type UserSession,
} from "@customreport/shared";
import type { Request, Response } from "express";
import { z } from "zod";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AgentationInboxRepository,
  annotationIdFromInboxId,
} from "./agentation-inbox.repository.js";
import { executeAgentationRequest } from "./agentation-wire.js";
import {
  feedbackAccessFromSession,
  type ProductFeedbackRepository,
} from "./product-feedback.repository.js";
import { serializeFeedback } from "./product-feedback-wire.js";

const statusSchema = z.object({ status: feedbackStatusSchema }).strict();
const commentSchema = z
  .object({
    comment: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  })
  .strict();
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const DEFAULT_FEEDBACK_LIMIT = 100;
const MAX_FEEDBACK_LIMIT = 100;
const FEEDBACK_PATH = "/feedback";
const LOG_PHASE = "product-feedback";

export interface FeedbackRouteDeps {
  readonly repository: ProductFeedbackRepository;
  readonly frontendOrigin: string;
  readonly logger: AppLogger;
  readonly prisma?: PrismaService;
  readonly agentationEnabled?: boolean;
}

function feedbackId(path: string, suffix = ""): string | null {
  return (
    new RegExp(`^/feedback/([a-zA-Z0-9_-]+)${suffix}$`).exec(path)?.[1] ?? null
  );
}

function requestedLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isSafeInteger(parsed)
    ? Math.min(MAX_FEEDBACK_LIMIT, Math.max(1, parsed))
    : DEFAULT_FEEDBACK_LIMIT;
}

function agentationInboxRepository(
  deps: FeedbackRouteDeps,
): AgentationInboxRepository | null {
  return deps.agentationEnabled === true && deps.prisma
    ? new AgentationInboxRepository(deps.prisma)
    : null;
}

async function listFeedback(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
): Promise<void> {
  const access = feedbackAccessFromSession(session);
  const limit = requestedLimit(req.query.limit);
  const requestedUrl =
    typeof req.query.url === "string" ? req.query.url : undefined;
  const normalizedUrl = requestedUrl
    ? normalizeFeedbackPath(requestedUrl)
    : undefined;
  const search = requestedUrl
    ? new URL(requestedUrl, deps.frontendOrigin).searchParams
    : null;
  const focusId = search?.get("feedback") ?? undefined;
  const [legacy, agentation] = await Promise.all([
    deps.repository.list(
      access,
      {
        limit,
        ...(normalizedUrl ? { url: normalizedUrl } : {}),
      },
      focusId,
    ),
    agentationInboxRepository(deps)?.list(access, {
      limit,
      ...(normalizedUrl ? { url: normalizedUrl } : {}),
    }) ?? Promise.resolve({ feedbacks: [], total: 0 }),
  ]);
  const feedback = [...legacy.feedbacks, ...agentation.feedbacks]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
    .map(serializeFeedback);

  res.setHeader("cache-control", "no-store");
  res.status(HTTP_OK).json({
    feedback,
    total: legacy.total + agentation.total,
  });
}

async function changeStatus(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const { status } = statusSchema.parse(req.body);
  const access = feedbackAccessFromSession(session);
  const agentation = agentationInboxRepository(deps);
  if (annotationIdFromInboxId(id) && agentation) {
    const record = await agentation.updateInboxStatus(access, id, status);
    res.status(HTTP_OK).json(serializeFeedback(record));
    return;
  }

  const changed = await deps.repository.update(access, id, {
    status,
    resolvedAt:
      status === "resolved" || status === "wont_fix" ? new Date() : null,
  });
  deps.logger.info("product feedback status changed", {
    phase: LOG_PHASE,
    action: "status",
    feedbackId: id,
    actorId: session.userId,
    role: session.role,
    status,
  });
  res.status(HTTP_OK).json(serializeFeedback(changed));
}

async function editFeedback(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const { comment } = commentSchema.parse(req.body);
  const changed = await deps.repository.update(
    feedbackAccessFromSession(session),
    id,
    { message: comment },
  );
  res.status(HTTP_OK).json(serializeFeedback(changed));
}

async function closeFeedback(
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const agentation = agentationInboxRepository(deps);
  if (annotationIdFromInboxId(id) && agentation) {
    await agentation.updateInboxStatus(
      feedbackAccessFromSession(session),
      id,
      "wont_fix",
    );
    res.sendStatus(HTTP_NO_CONTENT);
    return;
  }
  await deps.repository.update(feedbackAccessFromSession(session), id, {
    status: "wont_fix",
    resolvedAt: new Date(),
  });
  deps.logger.info("product feedback closed", {
    phase: LOG_PHASE,
    action: "close",
    feedbackId: id,
    actorId: session.userId,
    role: session.role,
  });
  res.sendStatus(HTTP_NO_CONTENT);
}

async function executeAgentationRoute(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  agentationAgent: boolean,
): Promise<boolean> {
  if (deps.agentationEnabled !== true || !deps.prisma) return false;
  return executeAgentationRequest(req, res, session, deps.prisma, deps.logger, {
    actor: agentationAgent ? "agent" : "human",
    isAgent: agentationAgent,
    frontendOrigin: deps.frontendOrigin,
  });
}

async function executeFeedbackCollectionRoute(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
): Promise<boolean> {
  if (req.path !== FEEDBACK_PATH) return false;
  if (req.method !== "GET") return false;
  await listFeedback(req, res, session, deps);
  return true;
}

async function executeFeedbackItemRoute(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
): Promise<boolean> {
  const statusTarget =
    req.method === "PATCH" ? feedbackId(req.path, "/status") : null;
  if (statusTarget) {
    await changeStatus(req, res, session, deps, statusTarget);
    return true;
  }
  const editTarget = req.method === "PUT" ? feedbackId(req.path) : null;
  if (editTarget) {
    await editFeedback(req, res, session, deps, editTarget);
    return true;
  }
  const closeTarget = req.method === "DELETE" ? feedbackId(req.path) : null;
  if (!closeTarget) return false;
  await closeFeedback(res, session, deps, closeTarget);
  return true;
}

export async function executeFeedbackRequest(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  agentationAgent = false,
): Promise<void> {
  res.setHeader("cache-control", "no-store");
  if (await executeAgentationRoute(req, res, session, deps, agentationAgent))
    return;
  if (await executeFeedbackCollectionRoute(req, res, session, deps)) return;
  if (await executeFeedbackItemRoute(req, res, session, deps)) return;
  res
    .status(HTTP_NOT_FOUND)
    .json({ error: "not_found", message: "Feedback endpoint not found." });
}
