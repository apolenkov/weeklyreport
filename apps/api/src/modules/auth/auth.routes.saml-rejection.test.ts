import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginAttemptsTotal,
  metricsRegistry,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  type AuditLogger,
  createNullAuditLogger,
} from "../../lib/audit-logger.js";
import {
  createSamlAuthenticationCallback,
  createSamlCallbackHandler,
} from "./auth.routes";
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
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/auth/error?reason=invalid_assertion`,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("audits and meters a production-parser signature rejection before provisioning", async () => {
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

    expect(loginFail).toHaveBeenCalledWith({
      userId: "anonymous",
      role: null,
      ip: "127.0.0.1",
      reason: "invalid_assertion",
    });
    expect(await loginAttemptsTotal.get()).toMatchObject({
      values: [{ labels: { method: "saml", outcome: "fail" }, value: 1 }],
    });
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/auth/error?reason=invalid_assertion`,
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
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
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe("SAML post-passport callback — audit error hygiene", () => {
  const INTERNAL_MARKER = "SECRET_INTERNAL_DB_DETAIL";

  type LoginFailMock = ReturnType<typeof vi.fn<AuditLogger["loginFail"]>>;

  function makeCallbackDeps(loginFail: LoginFailMock) {
    const authController = {
      issueSessionCookie: vi.fn(),
      verifySessionToken: vi.fn(),
    };
    const prisma = {
      user: {
        findFirst: vi.fn(() => Promise.reject(new Error(INTERNAL_MARKER))),
      },
    } as unknown as PrismaClient;
    const provisionLeadWorkspace = vi.fn();
    const auditLogger = {
      ...createNullAuditLogger(),
      loginSuccess: vi.fn(),
      loginFail,
    };
    return {
      deps: {
        prisma,
        authController,
        auditLogger,
        provisionLeadWorkspace,
        frontendUrl: FRONTEND_URL,
        env: {},
      } as unknown as Parameters<typeof createSamlCallbackHandler>[0],
      loginFail,
    };
  }

  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("records a fixed reason in the audit record, never the internal error detail", async () => {
    const req = makeReq();
    req.user = PROFILE;
    const res = makeRes();
    const next = vi.fn();
    const { deps, loginFail } = makeCallbackDeps(
      vi.fn<AuditLogger["loginFail"]>(),
    );

    await createSamlCallbackHandler(deps)(req, res, next);

    expect(loginFail).toHaveBeenCalledTimes(1);
    expect(loginFail).toHaveBeenCalledWith({
      userId: "anonymous",
      role: null,
      ip: "127.0.0.1",
      reason: "callback-error",
    });
    const recordedReason = loginFail.mock.calls[0]?.[0]?.reason;
    expect(recordedReason).not.toContain(INTERNAL_MARKER);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("meters the failure as a failed SAML login", async () => {
    const req = makeReq();
    req.user = PROFILE;
    const res = makeRes();
    const next = vi.fn();
    const { deps } = makeCallbackDeps(vi.fn<AuditLogger["loginFail"]>());

    await createSamlCallbackHandler(deps)(req, res, next);

    expect(await metricsRegistry.metrics()).toContain(
      'cr_login_attempts_total{method="saml",outcome="fail"} 1',
    );
  });
});
