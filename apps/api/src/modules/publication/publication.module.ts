import { Module } from '@nestjs/common';

import { PublicationService } from './publication.service';
import { PublicationPrismaRepository } from './publication.prisma-repository';

@Module({
  providers: [
    PublicationPrismaRepository,
    {
      provide: PublicationService,
      useFactory: (repo: PublicationPrismaRepository) =>
        new PublicationService(repo),
      inject: [PublicationPrismaRepository],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}
