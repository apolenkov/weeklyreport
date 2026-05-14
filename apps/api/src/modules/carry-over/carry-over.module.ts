import { Module } from "@nestjs/common";

import { CarryOverService } from "./carry-over.service";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";

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
  exports: [CarryOverService],
})
export class CarryOverModule {}
