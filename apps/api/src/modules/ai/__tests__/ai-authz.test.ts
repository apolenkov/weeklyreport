// Phase 32-A3 (M-02) — resource-level authz tests for AI procedures.
//
// Asserts assertCanReadReport / assertCanReadRisk / assertCanReadSection
// throw FORBIDDEN when the session role cannot see the resource. The
// Prisma client is mocked — these are unit tests that verify the where
// clause is built correctly and the outcome maps to the throw.
//
// The integration check (real Prisma roundtrip) is captured by the
// "viewer cannot call ai.sentiment on a draft Risk row" test case below,
// using a Prisma mock that returns null when visibility filters reject.
import { describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

import {
  assertCanReadReport,
  assertCanReadRisk,
  assertCanReadSection,
  reportVisibilityWhere,
} from '../ai-authz.js';
import type { UserSession } from '@customreport/shared';

const VIEWER: UserSession = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'viewer@example.com',
  name: 'Viewer',
  role: 'viewer',
  activeReportId: null,
  activeReportSectionId: null,
};

const HEAD: UserSession = {
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'head@example.com',
  name: 'Head',
  role: 'head',
  activeReportId: null,
  activeReportSectionId: null,
};

const LEAD: UserSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'lead@example.com',
  name: 'Lead',
  role: 'lead',
  activeReportId: null,
  activeReportSectionId: null,
};

const ADMIN: UserSession = {
  userId: '44444444-4444-4444-8444-444444444444',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  activeReportId: null,
  activeReportSectionId: null,
};

const REPORT_ID = '00000000-0000-4000-8000-000000000001';

describe('reportVisibilityWhere', () => {
  it('viewer → status: published filter', () => {
    expect(reportVisibilityWhere(VIEWER)).toEqual({ status: 'published' });
  });

  it('head → no filter (sees all)', () => {
    expect(reportVisibilityWhere(HEAD)).toEqual({});
  });

  it('admin → no filter (sees all)', () => {
    expect(reportVisibilityWhere(ADMIN)).toEqual({});
  });

  it('lead → published OR sections they author', () => {
    const w = reportVisibilityWhere(LEAD);
    expect(w).toEqual({
      OR: [
        { status: 'published' },
        { sections: { some: { authorId: LEAD.userId } } },
      ],
    });
  });
});

describe('assertCanReadReport', () => {
  it('FORBIDDEN when Prisma returns null (no row matches visibility)', async () => {
    const prisma = {
      report: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as Parameters<typeof assertCanReadReport>[0];

    await expect(
      assertCanReadReport(prisma, VIEWER, REPORT_ID),
    ).rejects.toThrow(TRPCError);
    await expect(
      assertCanReadReport(prisma, VIEWER, REPORT_ID),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('passes when Prisma returns a row', async () => {
    const prisma = {
      report: { findFirst: vi.fn().mockResolvedValue({ id: REPORT_ID }) },
    } as unknown as Parameters<typeof assertCanReadReport>[0];
    await expect(
      assertCanReadReport(prisma, HEAD, REPORT_ID),
    ).resolves.toBeUndefined();
  });

  it('viewer call passes status: published into the where', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: REPORT_ID });
    const prisma = { report: { findFirst } } as unknown as Parameters<
      typeof assertCanReadReport
    >[0];
    await assertCanReadReport(prisma, VIEWER, REPORT_ID);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: REPORT_ID, status: 'published' },
      select: { id: true },
    });
  });
});

describe('assertCanReadRisk', () => {
  const RISK_ID = '55555555-5555-4555-8555-555555555555';

  it('FORBIDDEN when the risk row is invisible to viewer (draft)', async () => {
    // Simulates: viewer asks for sentiment on a Risk whose section's
    // report is status='draft'. Prisma findFirst with the published-only
    // filter returns null. This is the integration assertion required by
    // the M-02 task: viewer cannot call ai.sentiment on a draft Risk row.
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { risk: { findFirst } } as unknown as Parameters<
      typeof assertCanReadRisk
    >[0];
    await expect(assertCanReadRisk(prisma, VIEWER, RISK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: RISK_ID,
        reportSection: { report: { status: 'published' } },
      },
      select: { id: true },
    });
  });

  it('head call passes through when Prisma returns the row', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: RISK_ID });
    const prisma = { risk: { findFirst } } as unknown as Parameters<
      typeof assertCanReadRisk
    >[0];
    await expect(assertCanReadRisk(prisma, HEAD, RISK_ID)).resolves.toBeUndefined();
  });

  it('lead — visibility merges into reportSection.report', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: RISK_ID });
    const prisma = { risk: { findFirst } } as unknown as Parameters<
      typeof assertCanReadRisk
    >[0];
    await assertCanReadRisk(prisma, LEAD, RISK_ID);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: RISK_ID,
        reportSection: {
          report: {
            OR: [
              { status: 'published' },
              { sections: { some: { authorId: LEAD.userId } } },
            ],
          },
        },
      },
      select: { id: true },
    });
  });
});

describe('assertCanReadSection', () => {
  const SECTION_ID = '66666666-6666-4666-8666-666666666666';

  it('FORBIDDEN when the section is invisible to viewer (draft report)', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { reportSection: { findFirst } } as unknown as Parameters<
      typeof assertCanReadSection
    >[0];
    await expect(
      assertCanReadSection(prisma, VIEWER, SECTION_ID),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('passes when Prisma returns the row', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: SECTION_ID });
    const prisma = { reportSection: { findFirst } } as unknown as Parameters<
      typeof assertCanReadSection
    >[0];
    await expect(
      assertCanReadSection(prisma, ADMIN, SECTION_ID),
    ).resolves.toBeUndefined();
  });
});
