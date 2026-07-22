import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";

import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.healthIndicator.check(key).up();
    } catch (error) {
      return this.healthIndicator.check(key).down({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
