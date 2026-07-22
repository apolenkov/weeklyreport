import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ClsModule } from "nestjs-cls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TelegramModule } from "./telegram.module.js";

const botToken = process.env.TG_BOT_TOKEN?.trim();
const ACTIVATION_ENV = {
  APP_BASE_URL: "http://localhost:3000",
  AUTH_DEV_MODE: "false",
  AUTH_JWT_SECRET: "test-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  DATABASE_URL:
    "postgresql://customreport:localdev@localhost:5432/customreport_test",
  FRONTEND_URL: "http://localhost:3000",
  HEAP_HEALTH_THRESHOLD_BYTES: "536870912",
  LOG_LEVEL: "info",
  NODE_ENV: "test",
  OTEL_SDK_DISABLED: "true",
  OTEL_TRACES_SAMPLER_ARG: "0",
  PDF_BASE_URL: "http://localhost:3000",
  PDF_EXPORT_JWT_SECRET: "activation-test-pdf-secret-at-least-32",
  PDF_OUTPUT_DIR: "storage/pdf-activation-test",
  PORT: "3002",
  REDIS_HOST: "localhost",
  REDIS_MAXMEMORY_BYTES: "209715200",
  REDIS_PORT: "6379",
} as const;

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false, generateId: false },
    }),
    TelegramModule,
  ],
})
class TelegramActivationTestModule {}

describe.skipIf(!botToken)("Telegram activation (real bot)", () => {
  beforeEach(() => {
    Object.entries(ACTIVATION_ENV).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails loud through TelegramModule until a real adapter is bound", async () => {
    await expect(
      NestFactory.createApplicationContext(TelegramActivationTestModule, {
        abortOnError: false,
        logger: false,
      }),
    ).rejects.toThrow(
      "Not implemented — see TODO(Phase-55-activation). Telegram bot not configured",
    );
  });
});
