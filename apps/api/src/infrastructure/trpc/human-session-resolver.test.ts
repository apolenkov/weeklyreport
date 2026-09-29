import type { UserSession } from "@customreport/shared";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthController } from "../../modules/auth/index.js";
import { PrismaService } from "../prisma/prisma.service";
import { resolveHumanSession } from "./trpc.context";

// The /pdfs download handler authenticates through `resolveHumanSession`, which
// must accept ONLY a real human session — never the PDF-worker token or the
// dev-mode synthetic session the full createContext chain also honors.

const SESSION_SECRET = "human-session-resolver-secret-32-chars-min";
const PDF_SECRET = "human-session-resolver-pdf-secret-32-chars";
const TEST_REPORT_ID = "11111111-2222-4333-8444-555555555555";

const viewerSession: UserSession = {
  userId: "a0000000-0000-4000-8000-0000000000a1",
  email: "viewer@test.local",
  name: "Viewer One",
  role: "viewer",
  activeReportId: null,
  activeReportSectionId: null,
};

interface PrismaStubOptions {
  isActive?: boolean;
  liveRole?: UserSession["role"];
  liveGroupId?: string;
  viewerGroups?: string[];
  // When true the user row is gone (hard-deleted) — findUnique returns null.
  missingUser?: boolean;
}

function makePrisma(opts: PrismaStubOptions = {}): PrismaService {
  const stub = {
    user: {
      findUnique: () =>
        Promise.resolve(
          opts.missingUser
            ? null
            : {
                isActive: opts.isActive ?? true,
                role: opts.liveRole ?? "viewer",
                reportingGroupId: opts.liveGroupId ?? null,
              },
        ),
    },
    viewerGroupAccess: {
      findMany: () =>
        Promise.resolve(
          (opts.viewerGroups ?? []).map((groupId) => ({ groupId })),
        ),
    },
    reportSection: {
      findFirst: () => Promise.resolve(null),
    },
    reportingGroup: {
      findUnique: () => Promise.resolve(null),
    },
    organization: {
      findUnique: () =>
        Promise.resolve({ shortName: "Demo", fullName: "Product Team" }),
      upsert: () =>
        Promise.resolve({ shortName: "Demo", fullName: "Product Team" }),
    },
  };
  return stub as unknown as PrismaService;
}

describe("resolveHumanSession", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", SESSION_SECRET);
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", PDF_SECRET);
    // Prove the resolver ignores dev-mode: it must reject regardless of flags.
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a PDF-export worker token (not a human session)", async () => {
    const authController = createAuthController(process.env);
    const workerToken = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: "pdf-export" },
      PDF_SECRET,
      { expiresIn: "5m" },
    );

    const result = await resolveHumanSession(workerToken, {
      verifySessionToken: (token) => authController.verifySessionToken(token),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma(),
    });

    expect(result).toBeNull();
  });

  it("rejects a garbage token even with AUTH_DEV_MODE=true (no dev fallback)", async () => {
    const authController = createAuthController(process.env);

    const result = await resolveHumanSession("not-a-jwt", {
      verifySessionToken: (token) => authController.verifySessionToken(token),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma(),
    });

    expect(result).toBeNull();
  });

  it("rejects a revoked session", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => viewerSession,
      sessionRevocation: { isRevoked: () => Promise.resolve(true) },
      prisma: makePrisma(),
    });

    expect(result).toBeNull();
  });

  it("rejects a deactivated account (isActive=false)", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => viewerSession,
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma({ isActive: false }),
    });

    expect(result).toBeNull();
  });

  it("overrides stale JWT role and group with the database values", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => ({
        ...viewerSession,
        role: "head",
        reportingGroupId: "stale-group",
      }),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma({ liveRole: "lead", liveGroupId: "live-group" }),
    });

    expect(result?.role).toBe("lead");
    expect(result?.reportingGroupId).toBe("live-group");
  });

  it("drops a stale JWT group when the database has none", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => ({
        ...viewerSession,
        reportingGroupId: "stale-group",
      }),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma(),
    });

    expect(result?.reportingGroupId).toBeUndefined();
  });

  it("rejects a hard-deleted user absent from the revoked set (null row fails closed)", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => viewerSession,
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma({ missingUser: true }),
    });

    expect(result).toBeNull();
  });

  it("returns the hydrated session for a valid, active, non-revoked human", async () => {
    const result = await resolveHumanSession("valid-token", {
      verifySessionToken: () => viewerSession,
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      prisma: makePrisma({ viewerGroups: ["group-1"] }),
    });

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(viewerSession.userId);
    // Hydration ran: viewer group access is populated per-request (not in the
    // JWT), which the download authz check reads.
    expect(result?.viewerGroupAccess).toEqual(["group-1"]);
  });
});
