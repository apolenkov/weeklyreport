import { Module } from "@nestjs/common";

import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";
import { CarryOverService } from "./carry-over.service";

@Module({
  providers: [
    CarryOverPrismaRepository,
    {
      provide: CarryOverService,
      useFactory: (repo: CarryOverPrismaRepository) =>
        new CarryOverService(repo),
      inject: [CarryOverPrismaRepository],
    },
  ],
  // The repository is exported for the auto-carry-over wiring (PeriodModule's
  // scheduler factory and the composition root both build orchestrator deps
  // from it directly).
  exports: [CarryOverService, CarryOverPrismaRepository],
})
export class CarryOverModule {}
