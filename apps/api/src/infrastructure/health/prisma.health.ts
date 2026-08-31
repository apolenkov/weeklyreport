import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { PrismaClient } from "@prisma/client";

import { errorMessage } from "../../lib/error-message.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { withReadinessTimeout } from "./readiness-timeout.js";

// The only Prisma surface the probe touches; narrow so tests inject a stub
// without an erasing cast.
export interface ProbeClient {
  $queryRaw: PrismaClient["$queryRaw"];
}

@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: ProbeClient,
    @Inject(HealthIndicatorService)
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await withReadinessTimeout("database", this.prisma.$queryRaw`SELECT 1`);
      return this.healthIndicator.check(key).up();
    } catch (error) {
      // The readiness body is served to unauthenticated callers: log the raw
      // failure detail internally, never echo it in the response.
      this.logger.error("database readiness check failed", {
        error: errorMessage(error),
      });
      return this.healthIndicator.check(key).down();
    }
  }
}
