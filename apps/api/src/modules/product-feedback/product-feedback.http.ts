import {
  feedbackCreateWireSchema,
  normalizeFeedbackPath,
  type UserSession,
} from "@customreport/shared";
import type { Request, Response } from "express";

import { WEEKLY_REPORT_FEEDBACK_PRODUCT } from "./product-feedback.repository.js";

export type FeedbackMethod = "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";

function isFeedbackMethod(method: string): method is FeedbackMethod {
  return ["GET", "POST", "PATCH", "DELETE", "OPTIONS"].includes(method);
}

function copyHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return headers;
}

function objectBody(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedPostBody(
  body: Record<string, unknown>,
  session: UserSession,
): Record<string, unknown> | null {
  const parsed = feedbackCreateWireSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    authorName: session.name,
    authorEmail: session.email,
    url: normalizeFeedbackPath(parsed.data.url),
    urlPattern: parsed.data.urlPattern
      ? normalizeFeedbackPath(parsed.data.urlPattern)
      : null,
  };
}

function normalizedPatchBody(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  if (typeof body.id !== "string" || typeof body.status !== "string") {
    return null;
  }
  return {
    id: body.id,
    status: body.status,
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
  };
}

function normalizedDeleteBody(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  if (body.deleteAll === true) {
    return { deleteAll: true, projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT };
  }
  if (typeof body.id !== "string") return null;
  return { id: body.id, projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT };
}

function normalizedBody(
  req: Request,
  session: UserSession,
): Record<string, unknown> | null {
  const body = objectBody(req.body);
  if (body === null) return null;
  if (req.method === "POST") return normalizedPostBody(body, session);
  if (req.method === "PATCH") return normalizedPatchBody(body);
  if (req.method === "DELETE") return normalizedDeleteBody(body);
  return body;
}

export function buildSitepingWebRequest(
  req: Request,
  session: UserSession,
): globalThis.Request | null {
  const method = req.method as FeedbackMethod;
  const url = new URL(req.originalUrl, "https://reports.example.com");
  url.searchParams.set("projectName", WEEKLY_REPORT_FEEDBACK_PRODUCT);
  const headers = copyHeaders(req);
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "OPTIONS") {
    const body = normalizedBody(req, session);
    if (body === null) return null;
    init.body = JSON.stringify(body);
    headers.set("content-type", "application/json");
  }
  return new globalThis.Request(url, init);
}

export async function forwardSitepingResponse(
  webResponse: globalThis.Response,
  res: Response,
): Promise<void> {
  webResponse.headers.forEach((value, name) => {
    if (name !== "content-length" && name !== "transfer-encoding") {
      res.setHeader(name, value);
    }
  });
  res.setHeader("cache-control", "no-store");
  res.status(webResponse.status);
  const body = Buffer.from(await webResponse.arrayBuffer());
  if (body.length === 0) res.end();
  else res.send(body);
}

export function validateFeedbackBoundary(
  req: Request,
  allowedOrigin: string,
): { status: number; error: string; message: string } | null {
  if (!isFeedbackMethod(req.method)) {
    return {
      status: 400,
      error: "unsupported_method",
      message: "Unsupported method.",
    };
  }
  const origin = req.headers.origin;
  if (
    req.method !== "GET" &&
    (typeof origin !== "string" || origin !== allowedOrigin)
  ) {
    return {
      status: 403,
      error: "forbidden_origin",
      message: "Request origin is not allowed.",
    };
  }
  return null;
}
