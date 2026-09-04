import {
  feedbackStatusSchema,
  MAX_FEEDBACK_DISMISS_REASON_LENGTH,
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
import { AgentationInboxActions } from "./agentation-inbox-actions.js";
import { executeAgentationRequest } from "./agentation-wire.js";
import { deleteFeedback } from "./product-feedback.delete.js";
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
const replySchema = z
  .object({
    content: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  })
  .strict();
const dismissSchema = z
  .object({
    reason: z.string().trim().min(1).max(MAX_FEEDBACK_DISMISS_REASON_LENGTH),
  })
  .strict();
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const NOT_FOUND_ERROR = "Feedback endpoint not found.";
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
function agentationInboxActions(
  deps: FeedbackRouteDeps,
): AgentationInboxActions | null {
  return deps.agentationEnabled === true && deps.prisma
    ? new AgentationInboxActions(deps.prisma)
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
    .map((record) => serializeFeedback(record, access));

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
  if (session.role !== "admin" && session.role !== "head") {
    res
      .status(HTTP_NOT_FOUND)
      .json({ error: "not_found", message: NOT_FOUND_ERROR });
    return;
  }
  const { status } = statusSchema.parse(req.body);
  if (status === "wont_fix" && annotationIdFromInboxId(id)) {
    res.status(HTTP_BAD_REQUEST).json({
      error: "dismiss_reason_required",
      message: "Use the dismiss action with a reason.",
    });
    return;
  }
  const access = feedbackAccessFromSession(session);
  const agentation = agentationInboxActions(deps);
  if (annotationIdFromInboxId(id) && agentation) {
    const record = await agentation.updateStatus(access, id, status);
    res.status(HTTP_OK).json(serializeFeedback(record, access));
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
  res.status(HTTP_OK).json(serializeFeedback(changed, access));
}
async function editFeedback(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const { comment } = commentSchema.parse(req.body);
  const access = feedbackAccessFromSession(session);
  const agentation = agentationInboxActions(deps);
  if (annotationIdFromInboxId(id) && agentation) {
    const changed = await agentation.editOriginal(access, id, comment);
    res.status(HTTP_OK).json(serializeFeedback(changed, access));
    return;
  }
  if (!(await deps.repository.ownsAuthor(access, id))) {
    res
      .status(HTTP_NOT_FOUND)
      .json({ error: "not_found", message: NOT_FOUND_ERROR });
    return;
  }
  const changed = await deps.repository.update(access, id, {
    message: comment,
  });
  res
    .status(HTTP_OK)
    .json(serializeFeedback(changed, feedbackAccessFromSession(session)));
}
async function replyFeedback(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const agentation = agentationInboxActions(deps);
  if (!agentation) {
    res.sendStatus(HTTP_NOT_FOUND);
    return;
  }
  const { content } = replySchema.parse(req.body);
  const changed = await agentation.reply(
    feedbackAccessFromSession(session),
    id,
    content,
  );
  res
    .status(HTTP_OK)
    .json(serializeFeedback(changed, feedbackAccessFromSession(session)));
}
async function dismissFeedback(
  req: Request,
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  const agentation = agentationInboxActions(deps);
  if (!agentation || (session.role !== "admin" && session.role !== "head")) {
    res.sendStatus(HTTP_NOT_FOUND);
    return;
  }
  const { reason } = dismissSchema.parse(req.body);
  const changed = await agentation.dismiss(
    feedbackAccessFromSession(session),
    id,
    reason,
  );
  res
    .status(HTTP_OK)
    .json(serializeFeedback(changed, feedbackAccessFromSession(session)));
}
export async function executeAgentationRoute(
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
export async function executeFeedbackCollectionRoute(
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
export async function executeFeedbackItemRoute(
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
  const replyTarget =
    req.method === "POST" ? feedbackId(req.path, "/replies") : null;
  if (replyTarget) {
    await replyFeedback(req, res, session, deps, replyTarget);
    return true;
  }
  const dismissTarget =
    req.method === "POST" ? feedbackId(req.path, "/dismiss") : null;
  if (dismissTarget) {
    await dismissFeedback(req, res, session, deps, dismissTarget);
    return true;
  }
  const deleteTarget = req.method === "DELETE" ? feedbackId(req.path) : null;
  if (deleteTarget) {
    await deleteFeedback(res, session, deps, deleteTarget);
    return true;
  }
  return false;
}
