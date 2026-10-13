import { Inject, Injectable } from "@nestjs/common";
import {
  type Organization,
  ORGANIZATION_SINGLETON_ID,
  organizationSchema,
  type OrganizationUpdate,
} from "@weeklyreport/shared";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type {
  OrganizationRepository,
  OrganizationTransition,
} from "./organization.service.js";

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
  ): Promise<OrganizationTransition> => {
    return this.prisma.$transaction(async (tx) => {
      // Hold the singleton lock until commit so audit describes this write's
      // actual predecessor even when another admin saves concurrently.
      const [existing] = await tx.$queryRaw<Organization[]>`
        SELECT "id", "shortName", "fullName", "createdAt", "updatedAt"
        FROM "Organization" WHERE "id" = ${ORGANIZATION_SINGLETON_ID} FOR UPDATE
      `;
      if (!existing) {
        throw new Error(
          `Organization singleton row '${ORGANIZATION_SINGLETON_ID}' is missing; apply the canonical init migration or restore the row`,
        );
      }
      const previous = organizationSchema.parse(existing);
      const row = await tx.organization.update({
        where: { id: ORGANIZATION_SINGLETON_ID },
        data: {
          shortName: input.shortName,
          fullName: input.fullName,
        },
      });
      return { previous, next: organizationSchema.parse(row) };
    });
  };
}
