import { Module } from "@nestjs/common";

import { OrganizationService } from "./organization.service.js";
import { OrganizationPrismaRepository } from "./organization.prisma-repository.js";

/**
 * UFB-047 / Phase 48-A: Organization identity module.
 *
 * Owns the singleton `Organization` row. Exposed to the tRPC router via
 * `OrganizationService` (the router resolves it from the Nest container).
 */
@Module({
  providers: [
    OrganizationPrismaRepository,
    {
      provide: OrganizationService,
      useFactory: (repo: OrganizationPrismaRepository) =>
        new OrganizationService(repo),
      inject: [OrganizationPrismaRepository],
    },
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
