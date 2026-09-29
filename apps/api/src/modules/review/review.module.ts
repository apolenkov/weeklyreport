import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
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
  imports: [ConfigModule],
  providers: [
    { provide: REVIEW_REPOSITORY, useClass: ReviewPrismaRepository },
    {
      provide: REVIEW_ACTIONS_REPOSITORY,
      useClass: ReviewActionsPrismaRepository,
    },
    {
      provide: ReviewService,
      useFactory: (repo: ReviewRepository, logger: AppLogger) =>
        new ReviewService(repo, logger.child({ service: "ReviewService" })),
      inject: [REVIEW_REPOSITORY, APP_LOGGER],
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
