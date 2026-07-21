import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginAttemptsTotal,
  metricsRegistry,
} from "../../infrastructure/metrics/metrics.registry.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createSamlAuthenticationCallback } from "./auth.routes";
import type { SamlProfile } from "./user-session.js";

const FRONTEND_URL = "https://app.example.com";
const PROFILE: SamlProfile = {
  samlId: "saml-user",
  email: "user@example.com",
  displayName: "SAML User",
  role: "viewer",
};

function makeReq(): Request {
  return { ip: "127.0.0.1" } as unknown as Request;
}

function makeRes() {
  const res = { redirect: vi.fn() };
  return res as unknown as Response & typeof res;
}

function makeDeps() {
  const loginFail = vi.fn();
  return {
    deps: {
      auditLogger: { ...createNullAuditLogger(), loginFail },
      frontendUrl: FRONTEND_URL,
    },
    loginFail,
  };
}

describe("SAML authentication callback", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("audits, meters, and redirects a rejected assertion", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    const { deps, loginFail } = makeDeps();

    createSamlAuthenticationCallback(
      deps,
      req,
      res,
      next,
    )(null, false, { message: "invalid_assertion" });

    expect(loginFail).toHaveBeenCalledTimes(1);
    expect(loginFail).toHaveBeenCalledWith({
      userId: "anonymous",
      role: null,
      ip: "127.0.0.1",
      reason: "invalid_assertion",
    });
    expect(await metricsRegistry.metrics()).toContain(
      'cr_login_attempts_total{method="saml",outcome="fail"} 1',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/auth/error?reason=invalid_assertion`,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("treats a Passport error as a rejection", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    const { deps, loginFail } = makeDeps();

    createSamlAuthenticationCallback(
      deps,
      req,
      res,
      next,
    )(new Error("invalid signature"), PROFILE, {
      message: "invalid_assertion",
    });

    expect(loginFail).toHaveBeenCalledTimes(1);
    expect(await loginAttemptsTotal.get()).toMatchObject({
      values: [{ labels: { method: "saml", outcome: "fail" }, value: 1 }],
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/auth/error?reason=invalid_assertion`,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("hands an accepted profile to the existing success path", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    const { deps, loginFail } = makeDeps();

    createSamlAuthenticationCallback(deps, req, res, next)(null, PROFILE, {});

    expect(req.user).toBe(PROFILE);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(loginFail).not.toHaveBeenCalled();
    expect(await metricsRegistry.metrics()).not.toContain(
      'cr_login_attempts_total{method="saml",outcome="fail"}',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
