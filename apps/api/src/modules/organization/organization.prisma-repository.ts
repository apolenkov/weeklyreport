import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type Organization,
  organizationSchema,
  type OrganizationUpdate,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OrganizationRepository } from "./organization.service.js";

/**
 * Prisma implementation of OrganizationRepository.
 *
 * The seed migration inserts the singleton row on first apply (with
 * ON CONFLICT DO NOTHING), so on a healthy boot `getOrganization` always
 * finds a row. The defensive `upsert` here is a safety net for edge cases:
 *   - dev DBs reset without `migrate reset` (rare but possible)
 *   - integration tests that truncate `Organization` between cases
 * Defaults come from `DEFAULT_ORGANIZATION_IDENTITY` ('Org' /
 * 'Organization') so the fallback is tenant-agnostic. Real brand strings
 * ('Demo' etc.) live in the seed file and the admin-edited Organization
 * row only.
 */
@Injectable()
export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(): Promise<Organization> {
    // Read-only on the happy path: the singleton row is seeded at migration, so
    // a normal read must never write. The fallback is an upsert (not a create)
    // so two concurrent first-reads on a cold/truncated DB collapse to a no-op
    // update instead of racing into a P2002.
    const existing = await this.prisma.organization.findUnique({
      where: { id: "singleton" },
    });
    const row =
      existing ??
      (await this.prisma.organization.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          shortName: DEFAULT_ORGANIZATION_IDENTITY.shortName,
          fullName: DEFAULT_ORGANIZATION_IDENTITY.fullName,
        },
        update: {},
      }));
    return organizationSchema.parse({
      id: row.id,
      shortName: row.shortName,
      fullName: row.fullName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async updateOrganization(input: OrganizationUpdate): Promise<Organization> {
    // Singleton invariant: `id='singleton'` is the only writable row.
    // The `update` path matches; we use upsert in case the row was
    // somehow purged out-of-band (defense in depth — production should
    // never hit the create branch).
    const row = await this.prisma.organization.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
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
