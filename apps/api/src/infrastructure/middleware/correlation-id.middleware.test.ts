import { describe, expect, it, vi } from "vitest";

import type {
  CorrelationIdStore,
  CorrelationNext,
  CorrelationRequest,
  CorrelationResponse,
} from "./correlation-id.middleware.js";
import { CorrelationIdMiddleware } from "./correlation-id.middleware.js";

function buildMocks(headerId?: string): {
  req: CorrelationRequest;
  res: CorrelationResponse;
  next: CorrelationNext;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const headers: Record<string, string> = {};
  if (headerId) headers["x-request-id"] = headerId;
  const setHeader = vi.fn();
  const req = { headers };
  const res = { setHeader };
  const next = vi.fn<CorrelationNext>();
  return { req, res, next, setHeader };
}

function requestId(req: CorrelationRequest): string {
  const value = req.headers["x-request-id"];
  if (typeof value !== "string") throw new Error("Request id is not a string");
  return value;
}

function buildClsMock(): {
  cls: CorrelationIdStore;
  set: ReturnType<typeof vi.fn>;
} {
  const set = vi.fn();
  return { cls: { set }, set };
}

describe("CorrelationIdMiddleware", () => {
  it("generates a UUID when x-request-id is missing and writes it to req/res/CLS", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const { req, res, next, setHeader } = buildMocks();

    middleware.use(req, res, next);

    const generated = requestId(req);
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

  it("rejects a repeated x-request-id header instead of coercing the array", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const { req, res, next } = buildMocks();
    req.headers["x-request-id"] = ["first", "second"];

    middleware.use(req, res, next);

    expect(requestId(req)).toMatch(UUID_RE);
    expect(set).toHaveBeenCalledWith("correlationId", requestId(req));
  });

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("replaces an oversized (>128 char) x-request-id with a fresh UUID", () => {
    const { cls, set } = buildClsMock();
    const middleware = new CorrelationIdMiddleware(cls);
    const oversized = "a".repeat(129);
    const { req, res, next, setHeader } = buildMocks(oversized);

    middleware.use(req, res, next);

    const adopted = requestId(req);
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

    const adopted = requestId(req);
    expect(adopted).not.toBe(withControl);
    expect(adopted).toMatch(UUID_RE);
    expect(set).toHaveBeenCalledWith("correlationId", adopted);
  });

  it("writes each request's own correlationId to cls.set on successive calls", () => {
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
