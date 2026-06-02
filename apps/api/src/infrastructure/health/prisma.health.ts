import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthCheckError, HealthIndicator } from "@nestjs/terminus";
import type { PrismaService } from "../prisma/prisma.service.js";

// TODO(ratchet-no-deprecated): migrate to HealthIndicatorService
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-deprecated -- pending supervised migration, see TODO above
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    // TODO(ratchet-no-deprecated): migrate to HealthIndicatorService
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- pending supervised migration, see TODO above
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (_error) {
      // TODO(ratchet-no-deprecated): migrate to HealthIndicatorService
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- pending supervised migration, see TODO above
      throw new HealthCheckError(
        "Database check failed",
        this.getStatus(key, false),
      );
    }
  }
}
