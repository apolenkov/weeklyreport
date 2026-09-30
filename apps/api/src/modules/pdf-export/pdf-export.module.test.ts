import "reflect-metadata";

import type { Provider } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { PdfExportModule } from "./pdf-export.module.js";
import {
  PDF_EXPORT_ENQUEUER,
  PDF_EXPORT_TELEMETRY,
} from "./pdf-export.ports.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository.js";
import { PdfExportService } from "./pdf-export.service.js";

function createModule(withEnqueuer = true) {
  const productionProviders = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    PdfExportModule,
  ) as Provider[];
  const repository = {
    listPendingExportCandidates: vi.fn().mockResolvedValue([]),
  };
  const builder = Test.createTestingModule({
    providers: [
      ...productionProviders.filter(
        (provider) => provider === PdfExportService,
      ),
      { provide: PdfExportPrismaRepository, useValue: repository },
      { provide: APP_LOGGER, useValue: createNullLogger() },
      { provide: PDF_EXPORT_TELEMETRY, useValue: {} },
      {
        provide: ENV_CONFIG,
        useValue: { PDF_BASE_URL: "https://print.example.com" },
      },
      ...(withEnqueuer ? [{ provide: PDF_EXPORT_ENQUEUER, useValue: {} }] : []),
    ],
  });
  return { builder, repository };
}

describe("PdfExportModule service wiring", () => {
  it("resolves the native provider and forwards its repository and environment", async () => {
    const { builder, repository } = createModule();
    const moduleRef = await builder.compile();
    try {
      const service = moduleRef.get(PdfExportService);
      await expect(
        service.scanOrphanedPendingExports(() => Promise.resolve(false)),
      ).resolves.toEqual({
        inspected: 0,
        quarantined: 0,
        failed: 0,
      });
      expect(repository.listPendingExportCandidates).toHaveBeenCalledOnce();
      expect(service.buildAuthCookies("token")[0]?.domain).toBe(
        "print.example.com",
      );
    } finally {
      await moduleRef.close();
    }
  });

  it("refuses to construct the service without its enqueuer provider", async () => {
    await expect(createModule(false).builder.compile()).rejects.toThrow(
      "PdfExportEnqueuer",
    );
  });
});
