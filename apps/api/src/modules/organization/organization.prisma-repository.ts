import { Injectable } from '@nestjs/common';
import {
  organizationSchema,
  type Organization,
  type OrganizationUpdate,
} from '@customreport/shared';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { OrganizationRepository } from './organization.service.js';

/**
 * UFB-047 / Phase 48-A: Prisma implementation of OrganizationRepository.
 *
 * The seed migration inserts the singleton row on first apply (with
 * ON CONFLICT DO NOTHING), so on a healthy boot `getOrganization` always
 * finds a row. The defensive `upsert` here is a safety net for edge cases:
 *   - dev DBs reset without `migrate reset` (rare but possible)
 *   - integration tests that truncate `Organization` between cases
 * The defaults match the migration seed (Demo / Example Software Department &
 * Platforms) so the fallback identity is consistent with prod.
 */
@Injectable()
export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(): Promise<Organization> {
    const row = await this.prisma.organization.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        shortName: 'Demo',
        fullName: 'Example Software Department',
      },
      update: {},
    });
    return organizationSchema.parse({
      id: row.id,
      shortName: row.shortName,
      fullName: row.fullName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async updateOrganization(
    input: OrganizationUpdate,
  ): Promise<Organization> {
    // Singleton invariant: `id='singleton'` is the only writable row.
    // The `update` path matches; we use upsert in case the row was
    // somehow purged out-of-band (defense in depth — production should
    // never hit the create branch).
    const row = await this.prisma.organization.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        shortName: input.shortName,
        fullName: input.fullName,
      },
      update: {
        shortName: input.shortName,
        fullName: input.fullName,
      },
    });
    return organizationSchema.parse({
      id: row.id,
      shortName: row.shortName,
      fullName: row.fullName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
