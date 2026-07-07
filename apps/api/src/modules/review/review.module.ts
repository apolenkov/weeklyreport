import { Module } from "@nestjs/common";

import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
  ReviewService,
} from "./application/review.service.js";
import {
  REVIEW_ACTIONS_REPOSITORY,
  type ReviewActionsRepository,
  ReviewActionsService,
} from "./application/review-actions.service.js";
import { ReviewPrismaRepository } from "./infrastructure/review.prisma-repository.js";
import { ReviewActionsPrismaRepository } from "./infrastructure/review-actions.prisma-repository.js";

@Module({
  providers: [
    { provide: REVIEW_REPOSITORY, useClass: ReviewPrismaRepository },
    {
      provide: REVIEW_ACTIONS_REPOSITORY,
      useClass: ReviewActionsPrismaRepository,
    },
    {
      provide: ReviewService,
      useFactory: (repo: ReviewRepository) => new ReviewService(repo),
      inject: [REVIEW_REPOSITORY],
    },
    {
      provide: ReviewActionsService,
      useFactory: (repo: ReviewActionsRepository) =>
        new ReviewActionsService(repo),
      inject: [REVIEW_ACTIONS_REPOSITORY],
    },
  ],
  exports: [ReviewService, ReviewActionsService],
})
export class ReviewModule {}
