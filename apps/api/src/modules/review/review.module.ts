import { Module } from "@nestjs/common";
import { ReviewPrismaRepository } from "./review.prisma-repository.js";
import { ReviewService } from "./review.service.js";

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
