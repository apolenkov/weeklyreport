import { Module } from '@nestjs/common';
import { ReviewService } from './review.service.js';
import { ReviewPrismaRepository } from './review.prisma-repository.js';

@Module({
  providers: [
    ReviewPrismaRepository,
    {
      provide: ReviewService,
      useFactory: (repo: ReviewPrismaRepository) => new ReviewService(repo),
      inject: [ReviewPrismaRepository],
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
