import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { BullMQModule } from "../bullmq/bullmq.module";
import { ConfigModule } from "../config/config.module";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { HealthController } from "./health.controller.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { RedisHealthIndicator } from "./redis.health.js";

@Module({
  imports: [TerminusModule, BullMQModule, ConfigModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    BullMQHealthIndicator,
  ],
})
export class HealthModule {}
