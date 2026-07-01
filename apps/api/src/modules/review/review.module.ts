import { Module } from "@nestjs/common";

import { ReviewPrismaRepository } from "./review.prisma-repository.js";
import { ReviewService } from "./review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";
import { ReviewActionsService } from "./review-actions.service.js";

@Module({
  providers: [
    ReviewPrismaRepository,
    ReviewActionsPrismaRepository,
    {
      provide: ReviewService,
      useFactory: (repo: ReviewPrismaRepository) => new ReviewService(repo),
      inject: [ReviewPrismaRepository],
    },
    {
      provide: ReviewActionsService,
      useFactory: (repo: ReviewActionsPrismaRepository) =>
        new ReviewActionsService(repo),
      inject: [ReviewActionsPrismaRepository],
    },
  ],
  exports: [ReviewService, ReviewActionsService],
})
export class ReviewModule {}
