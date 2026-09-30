import "reflect-metadata";

import type { Provider } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { describe, expect, it } from "vitest";

import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import { metricsRegistry } from "../../infrastructure/metrics/metrics.registry.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { OrganizationService } from "../organization/index.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { RemindersModule } from "./reminders.module.js";
import { REMINDERS_ENQUEUER, REMINDERS_TELEMETRY } from "./reminders.ports.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository.js";
import { RemindersService } from "./reminders.service.js";

function createModule(withTelemetry = true) {
  // Exercise the production factories without starting their database/queue imports.
  const providers = (
    Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      RemindersModule,
    ) as Provider[]
  ).filter(
    (provider) =>
      typeof provider === "object" &&
      (provider.provide === RemindersService ||
        (withTelemetry && provider.provide === REMINDERS_TELEMETRY)),
  );
  return Test.createTestingModule({
    imports: [ClsModule.forRoot({ global: true })],
    providers: [
      ...providers,
      {
        provide: RemindersPrismaRepository,
        useValue: {
          ...unusedRemindersRepositoryStubs(),
          markStuckSendingUncertain: () => Promise.resolve(2),
        },
      },
      { provide: APP_LOGGER, useValue: createNullLogger() },
      { provide: REMINDERS_ENQUEUER, useValue: {} },
      { provide: OrganizationService, useValue: {} },
      { provide: ENV_CONFIG, useValue: {} },
    ],
  });
}

describe("RemindersModule telemetry wiring", () => {
  it("records reconciled deliveries through the production telemetry factory", async () => {
    const moduleRef = await createModule().compile();
    metricsRegistry.resetMetrics();
    try {
      const service = moduleRef.get(RemindersService);
      await service.reconcileStuckSendingExecutions(
        new Date("2026-09-29T12:00:00.000Z"),
      );

      expect(await metricsRegistry.metrics()).toContain(
        "cr_reminder_delivery_uncertain_total 2",
      );
    } finally {
      metricsRegistry.resetMetrics();
      await moduleRef.close();
    }
  });

  it("refuses to construct the production service without its telemetry provider", async () => {
    await expect(createModule(false).compile()).rejects.toThrow(
      "RemindersTelemetry",
    );
  });
});
