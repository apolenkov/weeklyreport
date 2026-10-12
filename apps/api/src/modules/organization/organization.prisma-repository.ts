import { Inject, Injectable } from "@nestjs/common";
import {
  type Organization,
  ORGANIZATION_SINGLETON_ID,
  organizationSchema,
  type OrganizationUpdate,
} from "@weeklyreport/shared";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OrganizationRepository } from "./organization.service.js";

// The init migration and seed establish this singleton before the API starts.
// Reads and updates must expose a missing row instead of silently rebuilding it.
@Injectable()
export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly getOrganization = async (): Promise<Organization> => {
    const existing = await this.prisma.organization.findUnique({
      where: { id: ORGANIZATION_SINGLETON_ID },
    });
    if (!existing) {
      throw new Error(
        `Organization singleton row '${ORGANIZATION_SINGLETON_ID}' is missing; apply the canonical init migration or restore the row`,
      );
    }
    const row = existing;
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
    // Only the seeded singleton row is writable; a missing row is a deployment
    // invariant failure, never an invitation to create a new tenant.
    const row = await this.prisma.organization.update({
      where: { id: ORGANIZATION_SINGLETON_ID },
      data: {
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
