import type { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  SamlIdentityMismatchError,
  type SamlProfile,
} from "./user-session";

// None of these scenarios drive the lead lazy-provision path (admin/viewer/head
// users, or an existing lead resync), so the injected seam must never fire — a
// throwing stub turns an accidental call into a visible failure.
const failIfProvisioned: ProvisionLeadWorkspace = vi.fn(() => {
  throw new Error("provisionLeadWorkspace must not be called in this scenario");
});

/**
 * Admin SAML login regression test.
 *
 * Pre-fix: `buildUserSession` cast `profile.role as 'lead' | 'head' | 'viewer'`
 * before passing it to `prisma.user.create`. Prisma's `Role` enum was
 * `{lead, head, viewer}` (no admin), so the cast lied at runtime and the DB
 * threw "Invalid enum value" on first admin SAML login.
 *
 * Post-fix: Prisma `Role` enum now includes `admin`, the cast is gone,
 * `SamlProfile.role` is typed as `DbRole`, and the session round-trips the
 * 'admin' role through to UserSession.
 */
describe("buildUserSession — admin SAML login", () => {
  function fakePrisma(opts: {
    existingUser?: {
      id: string;
      email: string;
      name: string;
      role: Role;
      samlId: string;
    } | null;
  }): PrismaClient {
    const existing = opts.existingUser ?? null;
    const fake = {
      user: {
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma user.findFirst contract (no awaitable work in the stub)
        findFirst: vi.fn(async () => existing),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<{ samlId: string; name: string }>;
            // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma user.update contract (no awaitable work in the stub)
          }) => ({
            ...(existing ?? { email: "unset", role: "lead" as Role }),
            id: where.id,
            ...data,
          }),
        ),
        create: vi.fn(
          async ({
            data,
          }: {
            data: { samlId: string; email: string; name: string; role: Role };
            // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma user.create contract (no awaitable work in the stub)
          }) => ({
            id: "new-user-id",
            ...data,
          }),
        ),
      },
      reportSection: {
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma reportSection.findFirst contract (no awaitable work in the stub)
        findFirst: vi.fn(async () => null),
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma reportSection.findUnique contract (no awaitable work in the stub)
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      report: {
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma report.findFirst contract (no awaitable work in the stub)
        findFirst: vi.fn(async () => null),
        create: vi.fn(),
      },
      project: {
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma project.findMany contract (no awaitable work in the stub)
        findMany: vi.fn(async () => []),
      },
      projectStatus: {
        createMany: vi.fn(),
      },
      reportingGroup: {
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma reportingGroup.findFirst contract (no awaitable work in the stub)
        findFirst: vi.fn(async () => ({
          id: "a0000000-0000-4000-8000-000000000301",
        })),
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma reportingGroup.findUnique contract (no awaitable work in the stub)
        findUnique: vi.fn(async () => ({
          name: "Software Development",
        })),
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma reportingGroup.upsert contract (no awaitable work in the stub)
        upsert: vi.fn(async () => ({
          id: "a0000000-0000-4000-8000-000000000301",
        })),
      },
    };
    return fake as unknown as PrismaClient;
  }

  it("persists role=admin and returns session with role=admin (no narrow cast crash)", async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-admin-1",
      email: "admin@customreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.role).toBe("admin");
    expect(session.email).toBe("admin@customreport.local");
    expect(session.reportingGroupName).toBe("Software Development");
    // The Prisma create call must have received role='admin' verbatim
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const createMock = prisma.user.create as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(createMock).toHaveBeenCalledTimes(1);
    const createArg = createMock.mock.calls[0]?.[0] as
      | { data: { role: string } }
      | undefined;
    expect(createArg?.data.role).toBe("admin");
  });

  // add-structured-user-name (review finding P3): the SAML stub synthesizes the
  // structured parts since the IdP name order is unknown — lastName = whole
  // displayName, firstName = " " (a single-space placeholder an admin completes
  // on edit; canSave trims it so it can't be re-saved), middleName/position null.
  it("create: SAML stub synthesizes name parts from displayName", async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-new-1",
      email: "newcomer@customreport.local",
      displayName: "Department Head",
      role: "viewer",
    };

    await buildUserSession(prisma, profile, failIfProvisioned);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const createMock = prisma.user.create as unknown as ReturnType<
      typeof vi.fn
    >;
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

  // add-structured-user-name (Decision: SAML is create-only). An existing user
  // hit by a plain SAML re-login is returned UNTOUCHED — no update, no create —
  // and the session reflects the EXISTING row, never the SAML profile's values.
  // (Previously this test was mislabeled "existing user update": it called the
  // create-only branch but only checked role==='admin', which is true of the
  // existing row regardless, so it gave false confidence on the central
  // contract. Review finding P2.)
  it("create-only: a SAML re-login never overwrites an existing user", async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: "existing-admin-id",
        email: "admin@customreport.local",
        name: "Old Name",
        role: "admin",
        samlId: "old-saml-id",
      },
    });
    // samlId matches the stored row: this test is about the create-only
    // invariant, not identity matching (that has its own describe block
    // below) — a mismatched samlId here would now be a refusal, not a
    // silent accept, per decide-saml-identity-and-session-pick.
    const profile: SamlProfile = {
      samlId: "old-saml-id",
      email: "admin@customreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    // Session reflects the EXISTING row, not the SAML profile.
    expect(session.role).toBe("admin");
    expect(session.name).toBe("Old Name");
    // The existing row is returned untouched: no write of any kind.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const updateMock = prisma.user.update as unknown as ReturnType<
      typeof vi.fn
    >;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const createMock = prisma.user.create as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    // No admin section auto-creation (admin is not a lead)
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const createSection = prisma.reportSection.create as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(createSection).not.toHaveBeenCalled();
  });

  // dev-login shares buildUserSession but passes resyncExisting:true so its
  // `?role=` switch still updates the live row — the one path that DOES write an
  // existing user. This guards the create-only carve-out from regressing closed.
  it("resyncExisting=true (dev-login) DOES update the existing user", async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: "existing-lead-id",
        email: "lead@customreport.local",
        name: "Lead One",
        role: "lead",
        samlId: "lead-saml",
      },
    });
    const profile: SamlProfile = {
      samlId: "lead-saml",
      email: "lead@customreport.local",
      displayName: "Lead One",
      role: "head",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned, {
      resyncExisting: true,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    const updateMock = prisma.user.update as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(session.role).toBe("head");
  });
});

// Concurrency regression: two first-logins of the same NEW identity both miss
// the fast-path find and both reach `prisma.user.create`, colliding on the
// `email`/`samlId` unique index. The loser must catch that P2002, re-read the
// winner's row, and return an identical session — never throw a 500.
describe("buildUserSession — first-login create race (P2002 reread)", () => {
  const WINNER = {
    id: "winner-user-id",
    email: "racer@customreport.local",
    name: "Racer",
    lastName: "Racer",
    firstName: " ",
    middleName: null,
    role: "viewer" as Role,
    samlId: "saml-racer",
    reportingGroupId: null,
  };

  function racingPrisma() {
    // findFirst call sequence: 1=email (miss), 2=samlId (miss) → existing=null
    // → create races and throws P2002; 3=catch-branch email re-read → WINNER.
    let userFindCalls = 0;
    const findFirst = vi.fn(() => {
      userFindCalls += 1;
      return Promise.resolve(userFindCalls >= 3 ? WINNER : null);
    });
    const create = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["email"] },
        }),
      ),
    );
    const fake = {
      user: { findFirst, create, update: vi.fn() },
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
    return { prisma: fake as unknown as PrismaClient, create, findFirst };
  }

  it("loser catches P2002, re-reads the winner, returns its session", async () => {
    const { prisma, create, findFirst } = racingPrisma();
    const profile: SamlProfile = {
      samlId: "saml-racer",
      email: "racer@customreport.local",
      displayName: "Racer",
      role: "viewer",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.userId).toBe("winner-user-id");
    expect(session.email).toBe("racer@customreport.local");
    // The losing create was attempted exactly once; the re-read found the winner
    // (2 fast-path finds + 1 catch-branch re-read).
    expect(create).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledTimes(3);
  });

  it("loser is REFUSED when the race winner's row carries a different samlId", async () => {
    const { prisma } = racingPrisma();
    // Same email as the winner, different IdP identity: the catch-branch
    // re-read must apply the same mismatch guard as the fast path — binding
    // the loser to the winner's role/group would be an identity takeover.
    const profile: SamlProfile = {
      samlId: "saml-INTRUDER",
      email: "racer@customreport.local",
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
      email: "racer@customreport.local",
      displayName: "Racer",
      role: "viewer",
    };

    await expect(
      buildUserSession(prisma, profile, failIfProvisioned),
    ).rejects.toThrow("connection reset");
  });
});

// decide-saml-identity-and-session-pick (ratified 2026-07-17): a reused email
// pointing at a different IdP identity must not silently inherit the old
// account's role/group. Pre-fix, the email-first lookup accepted ANY email
// match regardless of samlId — that acceptance is the exact behavior this
// change closes; the "reused email" case below pins the new, ratified
// refusal in its place.
describe("buildUserSession — samlId identity cross-check", () => {
  const EXISTING_USER = {
    id: "existing-user-id",
    email: "reused@customreport.local",
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
    const findFirst = vi.fn(
      ({ where }: { where: { email?: string; samlId?: string } }) => {
        if (where.email === EXISTING_USER.email) {
          return Promise.resolve({ ...EXISTING_USER, samlId: existingSamlId });
        }
        return Promise.resolve(null);
      },
    );
    const fake = {
      user: { findFirst, create: vi.fn(), update: vi.fn() },
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
          Promise.resolve({ name: "Software Development" }),
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
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(prisma.user.update).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("a stored user with no samlId on record still resolves by email, unchanged", async () => {
    // Empty samlId models the seed/dev-login carve-out: the ratified rule
    // only compares samlId when BOTH sides carry one.
    const { prisma } = fakePrisma("");
    const profile: SamlProfile = {
      samlId: "saml-any-idp-value",
      email: EXISTING_USER.email,
      displayName: "Whoever",
      role: "lead",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.userId).toBe(EXISTING_USER.id);
  });
});
