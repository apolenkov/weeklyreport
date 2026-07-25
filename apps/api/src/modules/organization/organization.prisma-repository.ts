import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type Organization,
  organizationSchema,
  type OrganizationUpdate,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OrganizationRepository } from "./organization.service.js";

// Upsert (not create) so cold/truncated DBs and concurrent first-reads
// collapse safely; seed normally inserts the singleton on migrate.
@Injectable()
export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(): Promise<Organization> {
    // Happy path is read-only (seeded row). Upsert fallback avoids P2002
    // races when two cold first-reads land together on a truncated DB.
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
    // Only id='singleton' is writable; upsert is defense in depth if the
    // row was purged out-of-band (production should never take create).
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
