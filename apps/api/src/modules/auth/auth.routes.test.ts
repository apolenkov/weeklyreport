import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient, Role } from '@prisma/client';

import { buildUserSession, type SamlProfile } from './auth.routes';

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
describe('buildUserSession — admin SAML login (Phase 32-C / H-01)', () => {
  function fakePrisma(opts: {
    existingUser?: { id: string; email: string; name: string; role: Role; samlId: string } | null;
  }): PrismaClient {
    const existing = opts.existingUser ?? null;
    const fake = {
      user: {
        findFirst: vi.fn(async () => existing),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ samlId: string; name: string }> }) => ({
          ...(existing ?? { email: 'unset', role: 'lead' as Role }),
          id: where.id,
          ...data,
        })),
        create: vi.fn(async ({ data }: { data: { samlId: string; email: string; name: string; role: Role } }) => ({
          id: 'new-user-id',
          ...data,
        })),
      },
      reportSection: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      report: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(),
      },
      project: {
        findMany: vi.fn(async () => []),
      },
      projectStatus: {
        createMany: vi.fn(),
      },
    };
    return fake as unknown as PrismaClient;
  }

  it('persists role=admin and returns session with role=admin (no narrow cast crash)', async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: 'saml-admin-1',
      email: 'admin@customreport.local',
      displayName: 'Administrator',
      role: 'admin',
    };

    const session = await buildUserSession(prisma, profile);

    expect(session.role).toBe('admin');
    expect(session.email).toBe('admin@customreport.local');
    // The Prisma create call must have received role='admin' verbatim
    const createMock = prisma.user.create as unknown as ReturnType<typeof vi.fn>;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0].data.role).toBe('admin');
  });

  it('preserves role=admin on existing user update (samlId rebind)', async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: 'existing-admin-id',
        email: 'admin@customreport.local',
        name: 'Old Name',
        role: 'admin',
        samlId: 'old-saml-id',
      },
    });
    const profile: SamlProfile = {
      samlId: 'saml-admin-rotated',
      email: 'admin@customreport.local',
      displayName: 'Administrator',
      role: 'admin',
    };

    const session = await buildUserSession(prisma, profile);

    expect(session.role).toBe('admin');
    // No admin section auto-creation (admin is not a lead)
    const createSection = prisma.reportSection.create as unknown as ReturnType<typeof vi.fn>;
    expect(createSection).not.toHaveBeenCalled();
  });
});
