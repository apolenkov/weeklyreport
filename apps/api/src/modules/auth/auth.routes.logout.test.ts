import { AUTH_COOKIE_NAME } from "@weeklyreport/shared";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createLogoutHandler, deriveLogoutOrigins } from "./auth.routes";

const STUB_ENV = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    redirect: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function makeReq(origin?: string): Request {
  return {
    headers: origin === undefined ? {} : { origin },
    ip: "127.0.0.1",
  } as unknown as Request;
}

describe("deriveLogoutOrigins", () => {
  it("normalizes full URLs (trailing slash, path) to bare origins", () => {
    const origins = deriveLogoutOrigins(
      "https://app.example.com/",
      "https://www.example.com/some/path, https://alt.example.com",
    );

    expect([...origins].sort()).toEqual([
      "https://alt.example.com",
      "https://app.example.com",
      "https://www.example.com",
    ]);
  });

  it("drops unparseable entries instead of admitting them", () => {
    const origins = deriveLogoutOrigins("https://app.example.com", "not a url");

    expect([...origins]).toEqual(["https://app.example.com"]);
  });
});

describe("createLogoutHandler origin gate", () => {
  const handler = createLogoutHandler({
    auditLogger: createNullAuditLogger(),
    env: STUB_ENV,
    allowedOrigins: deriveLogoutOrigins(
      "https://app.example.com/",
      "https://www.example.com",
    ),
  });

  it("accepts a browser Origin matching a trailing-slash FRONTEND_URL", () => {
    const res = makeRes();
    handler(makeReq("https://app.example.com"), res, vi.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/");
  });

  it("accepts a secondary FRONTEND_URLS origin", () => {
    const res = makeRes();
    handler(makeReq("https://www.example.com"), res, vi.fn());

    expect(res.redirect).toHaveBeenCalledWith("/");
  });

  it("rejects a foreign origin before clearing the cookie", () => {
    const res = makeRes();
    handler(makeReq("https://evil.example.net"), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("lets a missing Origin (same-origin form POST) through", () => {
    const res = makeRes();
    handler(makeReq(), res, vi.fn());

    expect(res.redirect).toHaveBeenCalledWith("/");
  });

  it("clears the session cookie before redirecting on an accepted logout", () => {
    const res = makeRes();
    handler(makeReq("https://app.example.com"), res, vi.fn());

    // The handler must emit the cleared cookie (empty value, Max-Age=0) —
    // the redirect alone would leave the browser logged in.
    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringMatching(new RegExp(`^${AUTH_COOKIE_NAME}=;.*Max-Age=0`)),
    );
    const setHeaderOrder = res.setHeader.mock.invocationCallOrder[0];
    const redirectOrder = res.redirect.mock.invocationCallOrder[0];
    expect(setHeaderOrder).toBeLessThan(redirectOrder ?? Infinity);
  });
});
