import "reflect-metadata";

import type { Provider } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { Test } from "@nestjs/testing";
import { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module.js";
import { EmailReminderProcessor } from "./infrastructure/bullmq/email-reminder.processor.js";
import { PdfExportProcessor } from "./infrastructure/bullmq/pdf-export.processor.js";
import { QueueRegistry } from "./infrastructure/bullmq/queue-registry.js";
import { WorkerLivenessRegistry } from "./infrastructure/bullmq/worker-liveness.registry.js";
import { ENV_CONFIG } from "./infrastructure/config/config.module.js";
import { EMAIL_PORT } from "./infrastructure/email/email.service.js";
import { APP_LOGGER } from "./lib/audit-logger.js";
import { createNullLogger } from "./lib/logger.js";
import { SnapshotAdminService } from "./modules/admin/index.js";
import { PDF_RENDERER, PdfExportService } from "./modules/pdf-export/index.js";
import { RemindersService } from "./modules/reminders/index.js";

describe("AppModule worker wiring", () => {
  it("resolves native workers without opening queues and preserves their log labels", async () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    ) as Provider[];
    const child = vi.fn(() => createNullLogger());
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...providers.filter(
          (provider) =>
            provider === PdfExportProcessor ||
            provider === EmailReminderProcessor,
        ),
        { provide: PdfExportService, useValue: {} },
        { provide: PDF_RENDERER, useValue: {} },
        { provide: RemindersService, useValue: {} },
        { provide: EMAIL_PORT, useValue: {} },
        { provide: SnapshotAdminService, useValue: {} },
        { provide: ENV_CONFIG, useValue: {} },
        { provide: APP_LOGGER, useValue: { ...createNullLogger(), child } },
        { provide: ClsService, useValue: null },
        { provide: QueueRegistry, useValue: {} },
        { provide: WorkerLivenessRegistry, useValue: {} },
      ],
    }).compile();
    try {
      expect(moduleRef.get(PdfExportProcessor)).toBeInstanceOf(
        PdfExportProcessor,
      );
      expect(moduleRef.get(EmailReminderProcessor)).toBeInstanceOf(
        EmailReminderProcessor,
      );
      expect(child).toHaveBeenCalledWith({ service: "pdf-export-worker" });
      expect(child).toHaveBeenCalledWith({ service: "email-reminder-worker" });
    } finally {
      await moduleRef.close();
    }
  });
});
