import type { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  type SamlProfile,
} from "./auth.routes";

// None of these scenarios drive the lead lazy-provision path (admin/viewer/head
// users, or an existing lead resync), so the injected seam must never fire — a
// throwing stub turns an accidental call into a visible failure.
const failIfProvisioned: ProvisionLeadWorkspace = vi.fn(() => {
  throw new Error("provisionLeadWorkspace must not be called in this scenario");
});

/**
 * Phase 32-C / H-01 — admin SAML login regression test.
 *
 * Pre-fix: `buildUserSession` cast `profile.role as 'lead' | 'head' | 'viewer'`
 * before passing it to `prisma.user.create`. Prisma's `Role` enum was
 * `{lead, head, viewer}` (no admin), so the cast lied at runtime and the DB
 * threw "Invalid enum value" on first admin SAML login.
 *
 * Post-fix: Prisma `Role` enum now includes `admin`, the cast is gone,
 * `SamlProfile.role` is typed as `Role`, and the session round-trips the
 * 'admin' role through to UserSession.
 */
describe("buildUserSession — admin SAML login (Phase 32-C / H-01)", () => {
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
    const profile: SamlProfile = {
      samlId: "saml-admin-rotated",
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
