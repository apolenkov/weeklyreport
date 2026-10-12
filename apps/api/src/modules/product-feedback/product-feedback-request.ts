import type { UserSession } from "@weeklyreport/shared";
import type { Request, Response } from "express";

import { executeAgentationRequest } from "./agentation-wire.js";
import type { FeedbackRouteDeps } from "./product-feedback.routes.js";
import {
  executeFeedbackCollectionRoute,
  executeFeedbackItemRoute,
} from "./product-feedback.routes.js";

const HTTP_NOT_FOUND = 404;
const NOT_FOUND_ERROR = "Feedback endpoint not found.";

export interface FeedbackRequestPrincipal {
  readonly session: UserSession;
  readonly agentationAgent?: boolean;
}

async function executeAgentationRoute(
  req: Request,
  res: Response,
  principal: FeedbackRequestPrincipal,
  deps: FeedbackRouteDeps,
): Promise<boolean> {
  if (deps.agentationEnabled !== true || !deps.prisma) return false;
  const { session, agentationAgent = false } = principal;
  return executeAgentationRequest(req, res, session, {
    prisma: deps.prisma,
    logger: deps.logger,
    options: {
      actor: agentationAgent ? "agent" : "human",
      isAgent: agentationAgent,
      frontendOrigin: deps.frontendOrigin,
    },
  });
}

export async function executeFeedbackRequest(
  req: Request,
  res: Response,
  principal: FeedbackRequestPrincipal,
  deps: FeedbackRouteDeps,
): Promise<void> {
  const { session } = principal;
  res.setHeader("cache-control", "no-store");
  if (await executeAgentationRoute(req, res, principal, deps)) return;
  if (await executeFeedbackCollectionRoute(req, res, session, deps)) return;
  if (await executeFeedbackItemRoute(req, res, session, deps)) return;
  res
    .status(HTTP_NOT_FOUND)
    .json({ error: "not_found", message: NOT_FOUND_ERROR });
}
