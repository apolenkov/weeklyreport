import { Module } from '@nestjs/common';

import { AdminService } from './admin.service';
import { AdminPrismaRepository } from './admin.prisma-repository';

@Module({
  providers: [
    AdminPrismaRepository,
    {
      provide: AdminService,
      useFactory: (repo: AdminPrismaRepository) =>
        new AdminService(repo),
      inject: [AdminPrismaRepository],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
