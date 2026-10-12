import type { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  ReportingGroupRequiredError,
  SamlIdentityMismatchError,
  type SamlProfile,
} from "./user-session";

// None of these scenarios drive the lead lazy-provision path (admin/viewer/head
// users, or an existing lead resync), so the injected seam must never fire — a
// throwing stub turns an accidental call into a visible failure.
const failIfProvisioned: ProvisionLeadWorkspace = vi.fn(() => {
  throw new Error("provisionLeadWorkspace must not be called in this scenario");
});

// `SamlProfile.role` flows uncast into `prisma.user.create`, so 'admin' must
// round-trip into UserSession without a runtime Prisma enum error.
describe("buildUserSession — admin SAML login", () => {
  function fakePrisma(opts: {
    existingUser?: {
      id: string;
      email: string;
      name: string;
      role: Role;
      samlId: string;
      reportingGroupId?: string | null;
    } | null;
  }): PrismaClient {
    const existing = opts.existingUser ?? null;
    const fake = {
      $queryRaw: vi.fn(() =>
        Promise.resolve(existing ? [{ id: existing.id }] : []),
      ),
      user: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() => Promise.resolve(existing)),
        update: vi.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<{ samlId: string; name: string }>;
          }) =>
            Promise.resolve({
              ...(existing ?? { email: "unset", role: "lead" as Role }),
              id: where.id,
              ...data,
            }),
        ),
        create: vi.fn(
          ({
            data,
          }: {
            data: { samlId: string; email: string; name: string; role: Role };
          }) =>
            Promise.resolve({
              id: "new-user-id",
              ...data,
            }),
        ),
      },
      reportSection: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      report: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      project: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
      projectStatus: {
        createMany: vi.fn(),
      },
      reportingGroup: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "a0000000-0000-4000-8000-000000000301",
          }),
        ),
        findUnique: vi.fn(() =>
          Promise.resolve({
            name: "Core Development",
          }),
        ),
        upsert: vi.fn(() =>
          Promise.resolve({
            id: "a0000000-0000-4000-8000-000000000301",
          }),
        ),
      },
    };
    return fake as unknown as PrismaClient;
  }

  it("refuses to provision a non-viewer with no group on record (typed error)", async () => {
    // A lead/head/admin without a group is an incomplete provision: silently
    // adopting the oldest group (or materializing the seeded default) would
    // fabricate an ownership the admin never chose — fail loud instead.
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-admin-1",
      email: "admin@weeklyreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toBeInstanceOf(ReportingGroupRequiredError);
  });

  // SAML stub: lastName=displayName, firstName whitespace placeholder (canSave trims it).
  it("create: SAML stub synthesizes name parts from displayName", async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-new-1",
      email: "newcomer@weeklyreport.local",
      displayName: "Department Head",
      role: "viewer",
    };

    await buildUserSession(prisma, profile, failIfProvisioned);

    const createMock = vi.mocked(prisma.user.create);
    const data = createMock.mock.calls[0]?.[0] as
      | {
          data: {
            name: string;
            lastName: string;
            firstName: string;
            middleName: string | null;
            position: string | null;
          };
        }
      | undefined;
    expect(data?.data.name).toBe("Department Head");
    expect(data?.data.lastName).toBe("Department Head");
    expect(data?.data.firstName).toBe(" ");
    expect(data?.data.middleName).toBeNull();
    expect(data?.data.position).toBeNull();
  });

  // SAML re-login is create-only: existing row is untouched; session uses existing values.
  it("create-only: a SAML re-login never overwrites an existing user", async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: "existing-admin-id",
        email: "admin@weeklyreport.local",
        name: "Old Name",
        role: "admin",
        samlId: "old-saml-id",
      },
    });
    // samlId deliberately matches the stored row: this pins the create-only
    // invariant, not identity matching (a mismatch is refused, not accepted —
    // covered by its own describe block below).
    const profile: SamlProfile = {
      samlId: "old-saml-id",
      email: "admin@weeklyreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.role).toBe("admin");
    expect(session.name).toBe("Old Name");
    const updateMock = vi.mocked(prisma.user.update);
    const createMock = vi.mocked(prisma.user.create);
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    const createSection = vi.mocked(prisma.reportSection.create);
    expect(createSection).not.toHaveBeenCalled();
  });

  // dev-login shares buildUserSession but passes resyncExisting:true so its
  // `?role=` switch still updates the live row — the one path that DOES write an
  // existing user. This guards the create-only carve-out from regressing closed.
  it("resyncExisting=true (dev-login) DOES update the existing user", async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: "existing-lead-id",
        email: "lead@weeklyreport.local",
        name: "Lead One",
        role: "lead",
        samlId: "lead-saml",
        reportingGroupId: "a0000000-0000-4000-8000-000000000301",
      },
    });
    const profile: SamlProfile = {
      samlId: "lead-saml",
      email: "lead@weeklyreport.local",
      displayName: "Lead One",
      role: "head",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned, {
      resyncExisting: true,
    });

    const updateMock = vi.mocked(prisma.user.update);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(session.role).toBe("head");
  });

  // Email identity is case-insensitive end to end: the lookup folds both
  // sides and the provisioned row stores the canonical normalized form, so a
  // case-variant assertion can never mint a second account.
  it("resolves the email case-insensitively and stores the normalized form", async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-new-2",
      email: "  NewComer@WeeklyReport.LOCAL  ",
      displayName: "New Comer",
      role: "viewer",
    };

    await buildUserSession(prisma, profile, failIfProvisioned);

    // The normalized address is bound as a parameter of the lower() lookup.
    const { $queryRaw: queryRaw } = prisma as unknown as {
      $queryRaw: ReturnType<typeof vi.fn>;
    };
    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual([
      "newcomer@weeklyreport.local",
    ]);
    const createMock = vi.mocked(prisma.user.create);
    const data = createMock.mock.calls[0]?.[0] as
      { data: { email: string; samlId: string } } | undefined;
    expect(data?.data.email).toBe("newcomer@weeklyreport.local");
    // The external identity stays verbatim — only the email is normalized.
    expect(data?.data.samlId).toBe("saml-new-2");
  });
});

// Two concurrent first-logins of the same NEW identity both miss the fast-path
// find and collide on the `email`/`samlId` unique index; the loser must catch
// P2002, re-read the winner's row and return that session, never a 500.
describe("buildUserSession — first-login create race (P2002 reread)", () => {
  const WINNER = {
    id: "winner-user-id",
    email: "racer@weeklyreport.local",
    name: "Racer",
    lastName: "Racer",
    firstName: " ",
    middleName: null,
    role: "viewer" as Role,
    samlId: "saml-racer",
    reportingGroupId: null,
  };

  function racingPrisma() {
    // Email lookups: 1=miss, then samlId (miss) → existing=null → create races
    // and throws P2002; 2=catch-branch email re-read → WINNER.
    let emailLookups = 0;
    const queryRaw = vi.fn(() => {
      emailLookups += 1;
      return Promise.resolve(emailLookups >= 2 ? [{ id: WINNER.id }] : []);
    });
    const findFirst = vi.fn(() => Promise.resolve(null));
    const create = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["email"] },
        }),
      ),
    );
    const fake = {
      $queryRaw: queryRaw,
      user: {
        findFirst,
        findUnique: vi.fn(() => Promise.resolve(WINNER)),
        create,
        update: vi.fn(),
      },
      reportSection: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      report: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      project: { findMany: vi.fn(() => Promise.resolve([])) },
      projectStatus: { createMany: vi.fn() },
      reportingGroup: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() => Promise.resolve(null)),
        upsert: vi.fn(() => Promise.resolve(null)),
      },
    };
    return {
      prisma: fake as unknown as PrismaClient,
      create,
      findFirst,
      queryRaw,
    };
  }

  it("loser catches P2002, re-reads the winner, returns its session", async () => {
    const { prisma, create, findFirst, queryRaw } = racingPrisma();
    const profile: SamlProfile = {
      samlId: "saml-racer",
      email: "racer@weeklyreport.local",
      displayName: "Racer",
      role: "viewer",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.userId).toBe("winner-user-id");
    expect(session.email).toBe("racer@weeklyreport.local");
    expect(create).toHaveBeenCalledTimes(1);
    // Fast path: email miss + samlId miss; catch branch: email hit (no samlId read).
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("loser is REFUSED when the race winner's row carries a different samlId", async () => {
    const { prisma } = racingPrisma();
    // Same email as the winner, different IdP identity: the catch-branch
    // re-read must apply the same mismatch guard as the fast path — binding
    // the loser to the winner's role/group would be an identity takeover.
    const profile: SamlProfile = {
      samlId: "saml-INTRUDER",
      email: "racer@weeklyreport.local",
      displayName: "Racer",
      role: "viewer",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toThrow(SamlIdentityMismatchError);
  });

  it("re-throws when create fails for a non-unique reason", async () => {
    const { prisma } = racingPrisma();
    // Override create to throw a non-P2002 error: it must propagate untouched.
    (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      Promise.reject(new Error("connection reset")),
    );
    const profile: SamlProfile = {
      samlId: "saml-racer",
      email: "racer@weeklyreport.local",
      displayName: "Racer",
      role: "viewer",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toThrow("connection reset");
  });
});

// A reused email pointing at a different IdP identity must not inherit the matched
// account's role/group: an email match with a mismatched samlId is refused.
describe("buildUserSession — samlId identity cross-check", () => {
  const EXISTING_USER = {
    id: "existing-user-id",
    email: "reused@weeklyreport.local",
    name: "Original Owner",
    lastName: "Owner",
    firstName: "Original",
    middleName: null,
    // head, not lead: the lead lazy-provision path is a separate concern
    // (see failIfProvisioned) and would otherwise fire on the accepted-match
    // scenarios below (no reportSection.findFirst hit in this fake).
    role: "head" as Role,
    reportingGroupId: "a0000000-0000-4000-8000-000000000301",
  };

  function fakePrisma(existingSamlId: string) {
    // Mirror the production lookup: lower() folds both sides of the comparison.
    const queryRaw = vi.fn((_strings: TemplateStringsArray, email: string) =>
      Promise.resolve(
        email.toLowerCase() === EXISTING_USER.email.toLowerCase()
          ? [{ id: EXISTING_USER.id }]
          : [],
      ),
    );
    const findFirst = vi.fn(() => Promise.resolve(null));
    const fake = {
      $queryRaw: queryRaw,
      user: {
        findFirst,
        findUnique: vi.fn(() =>
          Promise.resolve({ ...EXISTING_USER, samlId: existingSamlId }),
        ),
        create: vi.fn(),
        update: vi.fn(),
      },
      reportSection: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      report: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      project: { findMany: vi.fn(() => Promise.resolve([])) },
      projectStatus: { createMany: vi.fn() },
      reportingGroup: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        findUnique: vi.fn(() =>
          Promise.resolve({ name: "Core Development" }),
        ),
        upsert: vi.fn(() => Promise.resolve(null)),
      },
    };
    return { prisma: fake as unknown as PrismaClient, findFirst };
  }

  it("a reused email with a DIFFERENT stored samlId is refused, not re-linked or auto-created", async () => {
    const { prisma } = fakePrisma("saml-original-owner");
    const profile: SamlProfile = {
      samlId: "saml-new-idp-identity",
      email: EXISTING_USER.email,
      displayName: "New Identity",
      role: "lead",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toThrow(SamlIdentityMismatchError);

    // Refusal, not reconciliation: neither the re-link (update) nor the
    // auto-create (writeProvisionedUser's create path) may run.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("a reused email with the SAME stored samlId is accepted as the same identity", async () => {
    const { prisma } = fakePrisma("saml-shared");
    const profile: SamlProfile = {
      samlId: "saml-shared",
      email: EXISTING_USER.email,
      displayName: "Original Owner",
      role: "lead",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.userId).toBe(EXISTING_USER.id);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("a case-variant email resolves the same account instead of minting a second one", async () => {
    const { prisma } = fakePrisma("saml-shared");
    const profile: SamlProfile = {
      samlId: "saml-shared",
      email: EXISTING_USER.email.toUpperCase(),
      displayName: "Original Owner",
      role: "lead",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.userId).toBe(EXISTING_USER.id);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("a case-variant email under a foreign samlId is refused, never adopted", async () => {
    const { prisma } = fakePrisma("saml-original-owner");
    const profile: SamlProfile = {
      samlId: "saml-new-idp-identity",
      email: EXISTING_USER.email.toUpperCase(),
      displayName: "New Identity",
      role: "lead",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toThrow(SamlIdentityMismatchError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
