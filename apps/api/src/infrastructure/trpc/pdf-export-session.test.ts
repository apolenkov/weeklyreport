import type { INestApplication } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import { SessionRevocationService } from "../../modules/admin/index.js";
import { PrismaService } from "../prisma/prisma.service";
import { buildPdfExportSession, createContextFactory } from "./trpc.context";

// The PDF worker rebuilds the requester's session from the `requestedBy` claim.
// A deactivated/revoked requester must yield `null` (the auth middleware then
// rejects) so a stale 5-min PDF token cannot outlive the deactivation.

const REPORT_ID = "11111111-2222-4333-8444-555555555555";
const REQUESTER_ID = "a0000000-0000-4000-8000-0000000000c1";

interface PrismaStubOptions {
  isActive?: boolean;
  reportingGroupId?: string;
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
                id: REQUESTER_ID,
                email: "lead@test.local",
                name: "Lead One",
                role: "lead",
                isActive: opts.isActive ?? true,
                reportingGroupId: opts.reportingGroupId ?? null,
              },
        ),
    },
    viewerGroupAccess: { findMany: () => Promise.resolve([]) },
    reportSection: { findFirst: () => Promise.resolve(null) },
    reportingGroup: { findUnique: () => Promise.resolve(null) },
    organization: {
      findUnique: () =>
        Promise.resolve({ shortName: "PEO", fullName: "Product Team" }),
      upsert: () =>
        Promise.resolve({ shortName: "PEO", fullName: "Product Team" }),
    },
  };
  return stub as unknown as PrismaService;
}

const notRevoked = { isRevoked: () => Promise.resolve(false) };

describe("buildPdfExportSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the DI-managed session-revocation singleton for the context factory", () => {
    vi.stubEnv("AUTH_JWT_SECRET", "test-auth-secret-that-is-at-least-32-bytes");
    const prisma = makePrisma();
    const sessionRevocation = {
      isRevoked: vi.fn(() => Promise.resolve(false)),
    };
    const get = vi.fn((token: unknown) =>
      token === SessionRevocationService ? sessionRevocation : prisma,
    );
    const app = { get } as unknown as INestApplication;

    createContextFactory(app, createNullLogger());

    expect(get).toHaveBeenCalledWith(PrismaService);
    expect(get).toHaveBeenCalledWith(SessionRevocationService);
  });

  it("returns null for a deactivated requester", async () => {
    const result = await buildPdfExportSession(
      REPORT_ID,
      REQUESTER_ID,
      makePrisma({ isActive: false }),
      notRevoked,
    );

    expect(result).toBeNull();
  });

  it("returns null for a hard-deleted requester (null row, absent from the revoked set)", async () => {
    // A `requestedBy` whose User.findUnique returns null is barred — a
    // hard-deleted account must not keep exporting on a stale 5-min token even
    // though the revoked-set fast path never fired for it.
    const result = await buildPdfExportSession(
      REPORT_ID,
      REQUESTER_ID,
      makePrisma({ missingUser: true }),
      notRevoked,
    );

    expect(result).toBeNull();
  });

  it("returns null for a revoked requester (fast path)", async () => {
    const result = await buildPdfExportSession(
      REPORT_ID,
      REQUESTER_ID,
      makePrisma({ isActive: true }),
      { isRevoked: () => Promise.resolve(true) },
    );

    expect(result).toBeNull();
  });

  it("rebuilds a scoped session for an active requester", async () => {
    const result = await buildPdfExportSession(
      REPORT_ID,
      REQUESTER_ID,
      makePrisma({ reportingGroupId: "group-7" }),
      notRevoked,
    );

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(REQUESTER_ID);
    expect(result?.role).toBe("lead");
    expect(result?.activeReportId).toBe(REPORT_ID);
    expect(result?.reportingGroupId).toBe("group-7");
  });
});
