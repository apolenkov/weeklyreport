import type { UserSession } from "@customreport/shared";
import type { Request, Response } from "express";

import type { FeedbackRouteDeps } from "./product-feedback.routes.js";
import {
  executeAgentationRoute,
  executeFeedbackCollectionRoute,
  executeFeedbackItemRoute,
} from "./product-feedback.routes.js";

const HTTP_NOT_FOUND = 404;
const NOT_FOUND_ERROR = "Feedback endpoint not found.";

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
    .json({ error: "not_found", message: NOT_FOUND_ERROR });
}
