import type { Request } from "express";

export function readRequestCookie(
  request: Request,
  name: string,
): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== "object" || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

export function readRequestHeader(request: Request, name: string): unknown {
  const headers: unknown = request.headers;
  if (typeof headers !== "object" || headers === null) return undefined;
  return (headers as Record<string, unknown>)[name];
}
