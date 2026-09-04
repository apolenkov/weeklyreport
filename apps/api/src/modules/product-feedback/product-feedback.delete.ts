import type { UserSession } from "@customreport/shared";
import type { Response } from "express";

import { annotationIdFromInboxId } from "./agentation-inbox.repository.js";
import { AgentationInboxActions } from "./agentation-inbox-actions.js";
import { feedbackAccessFromSession } from "./product-feedback.repository.js";
import type { FeedbackRouteDeps } from "./product-feedback.routes.js";

const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const NOT_FOUND_ERROR = "Feedback endpoint not found.";

export async function deleteFeedback(
  res: Response,
  session: UserSession,
  deps: FeedbackRouteDeps,
  id: string,
): Promise<void> {
  if (session.role !== "admin") {
    res.status(HTTP_NOT_FOUND).json({
      error: "not_found",
      message: NOT_FOUND_ERROR,
    });
    return;
  }
  const access = feedbackAccessFromSession(session);
  const annotationId = annotationIdFromInboxId(id);
  const source = annotationId ? "agentation" : "legacy";
  if (annotationId) {
    if (deps.agentationEnabled !== true || !deps.prisma) {
      res.status(HTTP_NOT_FOUND).json({
        error: "not_found",
        message: NOT_FOUND_ERROR,
      });
      return;
    }
    await new AgentationInboxActions(deps.prisma).delete(access, id);
  } else {
    await deps.repository.delete(access, id);
  }
  deps.logger.info("product feedback deleted", {
    phase: "product-feedback",
    action: "delete",
    source,
    feedbackId: id,
    actorId: session.userId,
    role: session.role,
  });
  res.sendStatus(HTTP_NO_CONTENT);
}
