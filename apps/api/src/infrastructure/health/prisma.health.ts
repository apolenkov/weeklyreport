import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (_error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false),
      );
    }
  }
}
