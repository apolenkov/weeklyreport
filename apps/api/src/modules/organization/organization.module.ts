import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { OrganizationPrismaRepository } from "./organization.prisma-repository.js";
import { OrganizationService } from "./organization.service.js";

/**
 * Organization identity module.
 *
 * Owns the singleton `Organization` row. Exposed to the tRPC router via
 * `OrganizationService` (the router resolves it from the Nest container).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    OrganizationPrismaRepository,
    {
      provide: OrganizationService,
      useFactory: (repo: OrganizationPrismaRepository, logger: AppLogger) =>
        new OrganizationService(repo, logger),
      inject: [OrganizationPrismaRepository, APP_LOGGER],
    },
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
