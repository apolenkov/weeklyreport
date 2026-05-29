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
  exports: [CarryOverService],
})
export class CarryOverModule {}
