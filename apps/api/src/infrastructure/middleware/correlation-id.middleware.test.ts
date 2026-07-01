import type { NextFunction, Request, Response } from "express";
import type { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { CorrelationIdMiddleware } from "./correlation-id.middleware.js";

function buildMocks(headerId?: string): {
  req: Request;
  res: Response;
  next: NextFunction;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const headers: Record<string, string> = {};
  if (headerId) headers["x-request-id"] = headerId;
  const setHeader = vi.fn();
  const req = { headers } as unknown as Request;
  const res = { setHeader } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, setHeader };
}

function buildClsMock(): { cls: ClsService; set: ReturnType<typeof vi.fn> } {
  const set = vi.fn();
  const cls = { set } as unknown as ClsService;
  return { cls, set };
}

describe("CorrelationIdMiddleware", () => {
  it("generates a UUID when x-request-id is missing and writes it to req/res/CLS", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const { req, res, next, setHeader } = buildMocks();

    middleware.use(req, res, next);

    const generated = req.headers["x-request-id"] as string;
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(setHeader).toHaveBeenCalledWith("x-request-id", generated);
    expect(set).toHaveBeenCalledWith("correlationId", generated);
    expect(next).toHaveBeenCalledOnce();
  });

  it("preserves an incoming x-request-id and propagates it identically to req/res/CLS", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const { req, res, next, setHeader } = buildMocks("fixed-id-123");

    middleware.use(req, res, next);

    expect(req.headers["x-request-id"]).toBe("fixed-id-123");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "fixed-id-123");
    expect(set).toHaveBeenCalledWith("correlationId", "fixed-id-123");
    expect(next).toHaveBeenCalledOnce();
  });

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("replaces an oversized (>128 char) x-request-id with a fresh UUID", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const oversized = "a".repeat(129);
    const { req, res, next, setHeader } = buildMocks(oversized);

    middleware.use(req, res, next);

    const adopted = req.headers["x-request-id"] as string;
    expect(adopted).not.toBe(oversized);
    expect(adopted).toMatch(UUID_RE);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", adopted);
    expect(set).toHaveBeenCalledWith("correlationId", adopted);
  });

  it("replaces an x-request-id with a control character with a fresh UUID", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const withControl = `abc${String.fromCharCode(10)}def`;
    const { req, res, next } = buildMocks(withControl);

    middleware.use(req, res, next);

    const adopted = req.headers["x-request-id"] as string;
    expect(adopted).not.toBe(withControl);
    expect(adopted).toMatch(UUID_RE);
    expect(set).toHaveBeenCalledWith("correlationId", adopted);
  });

  it("isolates correlationId per request (no cross-request bleed)", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);

    const a = buildMocks("id-A");
    const b = buildMocks("id-B");

    middleware.use(a.req, a.res, a.next);
    middleware.use(b.req, b.res, b.next);

    expect(set).toHaveBeenNthCalledWith(1, "correlationId", "id-A");
    expect(set).toHaveBeenNthCalledWith(2, "correlationId", "id-B");
  });
});
