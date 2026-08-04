import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type Organization,
  organizationSchema,
  type OrganizationUpdate,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OrganizationRepository } from "./organization.service.js";

// One Organization row per deployment; the fixed id is the schema-level
// singleton invariant (`organizationSchema.id` is `z.literal("singleton")`).
const ORGANIZATION_SINGLETON_ID = "singleton";

// Upsert (not create) so cold/truncated DBs and concurrent first-reads
// collapse safely; seed normally inserts the singleton on migrate.
@Injectable()
export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly getOrganization = async (): Promise<Organization> => {
    const existing = await this.prisma.organization.findUnique({
      where: { id: ORGANIZATION_SINGLETON_ID },
    });
    const row =
      existing ??
      (await this.prisma.organization.upsert({
        where: { id: ORGANIZATION_SINGLETON_ID },
        create: {
          id: ORGANIZATION_SINGLETON_ID,
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
  };

  readonly updateOrganization = async (
    input: OrganizationUpdate,
  ): Promise<Organization> => {
    // Only the singleton row is writable; upsert is defense in depth if the
    // row was purged out-of-band (production should never take create).
    const row = await this.prisma.organization.upsert({
      where: { id: ORGANIZATION_SINGLETON_ID },
      create: {
        id: ORGANIZATION_SINGLETON_ID,
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
  };
}
