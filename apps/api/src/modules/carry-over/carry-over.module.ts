import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";
import { CarryOverService } from "./carry-over.service";

@Module({
  imports: [ConfigModule],
  providers: [
    CarryOverPrismaRepository,
    {
      provide: CarryOverService,
      useFactory: (repo: CarryOverPrismaRepository, logger: AppLogger) =>
        new CarryOverService(repo, logger),
      inject: [CarryOverPrismaRepository, APP_LOGGER],
    },
  ],
  // The repository is exported for the auto-carry-over wiring (PeriodModule's
  // scheduler factory and the composition root both build orchestrator deps
  // from it directly).
  exports: [CarryOverService, CarryOverPrismaRepository],
})
export class CarryOverModule {}
