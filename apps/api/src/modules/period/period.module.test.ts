import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { APP_LOGGER, AUDIT_LOGGER } from "../../lib/audit-logger.js";
import {
  SessionRevocationService,
  SnapshotAdminService,
} from "../admin/index.js";
import { AnalyticsCache } from "../analytics/index.js";
import {
  type AutoCarryOver,
  CarryOverPrismaRepository,
  CarryOverService,
} from "../carry-over/index.js";
import { PublicationService } from "../publication/index.js";
import { PolicyApplicatorService } from "../reminders/index.js";
import {
  PERIOD_ANALYTICS_CACHE,
  PERIOD_REPOSITORY,
  PERIOD_SETTINGS,
  PeriodService,
} from "./application/period.service.js";
import { PERIOD_TELEMETRY } from "./application/period-telemetry.port.js";
import { AutoArchiverScheduler } from "./infrastructure/auto-archiver.scheduler.js";
import { AutoPublisherScheduler } from "./infrastructure/auto-publisher.scheduler.js";
import {
  PERIOD_AUTO_CARRY_OVER,
  PeriodCreatorScheduler,
} from "./infrastructure/period-creator.scheduler.js";
import { PeriodModule } from "./period.module.js";

const appLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => appLogger,
};

describe("PeriodModule wiring", () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it("compiles the production module and resolves every scheduler dependency", async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: { mount: false, generateId: false },
        }),
        ConfigModule,
        PrismaModule,
        PeriodModule,
      ],
    })
      .overrideProvider(ENV_CONFIG)
      .useValue({})
      .overrideProvider(APP_LOGGER)
      .useValue(appLogger)
      .overrideProvider(AUDIT_LOGGER)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AnalyticsCache)
      .useValue({ invalidateAll: vi.fn().mockResolvedValue(undefined) })
      .overrideProvider(SnapshotAdminService)
      .useValue({ getSettings: vi.fn() })
      .overrideProvider(CarryOverService)
      .useValue({})
      .overrideProvider(CarryOverPrismaRepository)
      .useValue({
        findPreviousReportId: vi
          .fn()
          .mockRejectedValue(new Error("source read unavailable")),
      })
      .overrideProvider(PublicationService)
      .useValue({})
      .overrideProvider(PolicyApplicatorService)
      .useValue({})
      .overrideProvider(SessionRevocationService)
      .useValue({})
      .overrideProvider(PERIOD_REPOSITORY)
      .useValue({})
      .overrideProvider(PERIOD_TELEMETRY)
      .useValue({})
      .compile();

    expect(moduleRef.get(PeriodService)).toBeInstanceOf(PeriodService);
    expect(moduleRef.get(PERIOD_SETTINGS)).toBe(
      moduleRef.get(SnapshotAdminService),
    );
    expect(moduleRef.get(PERIOD_ANALYTICS_CACHE)).toBe(
      moduleRef.get(AnalyticsCache),
    );
    expect(moduleRef.get(PeriodCreatorScheduler)).toBeInstanceOf(
      PeriodCreatorScheduler,
    );
    expect(moduleRef.get(AutoPublisherScheduler)).toBeInstanceOf(
      AutoPublisherScheduler,
    );
    expect(moduleRef.get(AutoArchiverScheduler)).toBeInstanceOf(
      AutoArchiverScheduler,
    );
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
    expect(moduleRef.get(PERIOD_AUTO_CARRY_OVER)).toEqual(expect.any(Function));
    const carry = moduleRef.get<AutoCarryOver>(PERIOD_AUTO_CARRY_OVER);
    appLogger.warn.mockClear();
    expect(await carry("target-report")).toMatchObject({
      status: "failed",
      expected: false,
    });
    expect(appLogger.warn).toHaveBeenCalledWith("auto carry-over skipped", {
      targetReportId: "target-report",
      reason: "source read unavailable",
    });
  });
});
