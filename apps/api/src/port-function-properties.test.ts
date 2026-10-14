import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const PORT_INTERFACES = {
  "src/infrastructure/bullmq/job-enqueuer.ts": ["JobEnqueuer"],
  "src/infrastructure/cache/read-through-cache.ts": ["RedisReadThroughCache"],
  "src/modules/activity/activity.service.ts": ["ActivityRepository"],
  "src/modules/admin/action-log.service.ts": ["ActionLogRepository"],
  "src/modules/admin/admin-jobs.port.ts": ["AdminJobHandle", "AdminJobsQueue"],
  "src/modules/admin/admin-telemetry.port.ts": ["AdminTelemetry"],
  "src/modules/analytics/analytics.service.ts": [
    "AnalyticsRepository",
    "AnalyticsCachePort",
  ],
  "src/modules/archive/archive.service.ts": ["ArchiveRepository"],
  "src/modules/carry-over/auto-carry-over.ts": ["AutoCarryOverDeps"],
  "src/infrastructure/email/email.service.ts": ["EmailPort"],
  "src/modules/organization/organization.service.ts": [
    "OrganizationRepository",
  ],
  "src/modules/pdf-export/pdf-export.ports.ts": [
    "PdfExportEnqueuer",
    "PdfExportTelemetry",
  ],
  "src/modules/period/application/period-telemetry.port.ts": [
    "PeriodTelemetry",
  ],
  "src/modules/period/application/publish-side-effects.ts": [
    "PublishSideEffectsTelemetry",
  ],
  "src/modules/publication/application/publication-telemetry.port.ts": [
    "PublicationTelemetry",
  ],
  "src/modules/reminders/reminders-scope.types.ts": [
    "RemindersScopeRepository",
  ],
  "src/modules/reminders/reminders.ports.ts": [
    "RemindersEnqueuer",
    "RemindersTelemetry",
  ],
  "src/modules/reminders/reminders.types.ts": ["RemindersRepository"],
  "src/modules/reminders/reminders-enqueue.ts": ["ExecutionRecorder"],
  "src/modules/report-sections/application/report-sections-telemetry.port.ts": [
    "ReportSectionsTelemetry",
  ],
  "src/modules/telemetry/telemetry.ports.ts": [
    "TelemetryRepository",
    "TelemetryCachePort",
  ],
  "src/modules/review/application/review.service.ts": ["ReviewRepository"],
  "src/modules/search/application/search.service.ts": ["SearchRepository"],
} as const;

const ADAPTER_CLASSES = {
  "src/infrastructure/bullmq/admin-jobs-queue.adapter.ts":
    "AdminBullmqJobsQueue",
  "src/modules/activity/activity.prisma-repository.ts":
    "ActivityPrismaRepository",
  "src/modules/analytics/analytics.cache.ts": "AnalyticsCache",
  "src/modules/analytics/analytics.prisma-repository.ts":
    "AnalyticsPrismaRepository",
  "src/modules/admin/admin-prometheus-telemetry.adapter.ts":
    "AdminPrometheusTelemetry",
  "src/modules/pdf-export/pdf-export-bullmq-enqueuer.adapter.ts":
    "PdfExportBullmqEnqueuer",
  "src/modules/pdf-export/pdf-export-telemetry.adapter.ts":
    "PdfExportInfrastructureTelemetry",
  "src/modules/period/infrastructure/period-prometheus-telemetry.adapter.ts":
    "PeriodPrometheusTelemetry",
  "src/modules/publication/infrastructure/publication-prometheus-telemetry.adapter.ts":
    "PublicationPrometheusTelemetry",
  "src/modules/reminders/reminders-bullmq-enqueuer.adapter.ts":
    "RemindersBullmqEnqueuer",
  "src/modules/reminders/reminders-telemetry.adapter.ts":
    "RemindersInfrastructureTelemetry",
  "src/modules/reminders/reminders.prisma-repository.ts":
    "RemindersPrismaRepository",
  "src/modules/report-sections/infrastructure/report-sections-prometheus-telemetry.adapter.ts":
    "ReportSectionsPrometheusTelemetry",
  "src/modules/telemetry/telemetry.cache.ts": "TelemetryCache",
  "src/modules/telemetry/telemetry.prisma-repository.ts":
    "TelemetryPrismaRepository",
} as const;

const TARGETED_CLASSES = {
  "src/infrastructure/bullmq/queue-registry.ts": {
    className: "QueueRegistry",
    operations: ["get"],
  },
  "src/lib/nest-app-logger.adapter.ts": {
    className: "NestAppLoggerAdapter",
    operations: ["setLogger", "log", "error", "warn", "debug", "verbose"],
  },
  "src/modules/organization/organization.prisma-repository.ts": {
    className: "OrganizationPrismaRepository",
    operations: ["getOrganization", "updateOrganization"],
  },
  "src/modules/admin/action-log.prisma-repository.ts": {
    className: "ActionLogPrismaRepository",
    operations: ["listActionLog"],
  },
  "src/modules/archive/archive.prisma-repository.ts": {
    className: "ArchivePrismaRepository",
    operations: ["listArchiveReports", "getArchiveReport"],
  },
  "src/modules/review/infrastructure/review.prisma-repository.ts": {
    className: "ReviewPrismaRepository",
    operations: ["getSubmissionDashboard"],
  },
  "src/modules/search/infrastructure/search.prisma-repository.ts": {
    className: "SearchPrismaRepository",
    operations: ["search"],
  },
  "src/infrastructure/email/email.service.ts": {
    className: "EmailService",
    operations: ["sendMail", "sendMailMultipart"],
  },
  "src/modules/admin/session-revocation.service.ts": {
    className: "SessionRevocationService",
    operations: [
      "revokeSession",
      "restoreSession",
      "isRevoked",
      "onModuleDestroy",
    ],
  },
  "src/infrastructure/bullmq/raw-bullmq-processor.ts": {
    className: "RawBullMqProcessor",
    operations: [
      "processJob",
      "onJobFailed",
      "extraWorkerOptions",
      "onModuleInit",
      "onModuleDestroy",
    ],
  },
  "src/infrastructure/bullmq/pdf-export.processor.ts": {
    className: "PdfExportProcessor",
    operations: ["processJob", "onJobFailed"],
  },
  "src/infrastructure/bullmq/email-reminder.processor.ts": {
    className: "EmailReminderProcessor",
    operations: ["processJob", "onJobFailed", "extraWorkerOptions"],
  },
} as const;

function sourceFile(path: string): ts.SourceFile {
  const absolutePath = resolve(process.cwd(), path);
  return ts.createSourceFile(
    absolutePath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

function isReadonly(member: ts.Node): boolean {
  return ts.canHaveModifiers(member)
    ? (ts
        .getModifiers(member)
        ?.some(({ kind }) => kind === ts.SyntaxKind.ReadonlyKeyword) ?? false)
    : false;
}

describe("application port declaration shapes", () => {
  it.each(Object.entries(PORT_INTERFACES))(
    "%s declares no method signatures and marks properties readonly",
    (path, interfaceNames) => {
      const declarations = sourceFile(path).statements.filter(
        ts.isInterfaceDeclaration,
      );

      for (const interfaceName of interfaceNames) {
        const declaration = declarations.find(
          ({ name }) => name.text === interfaceName,
        );
        expect(declaration, interfaceName).toBeDefined();
        for (const member of declaration?.members ?? []) {
          expect(ts.isMethodSignature(member), interfaceName).toBe(false);
          if (ts.isPropertySignature(member)) {
            expect(isReadonly(member), member.name.getText()).toBe(true);
          }
        }
      }
    },
  );

  it.each(Object.entries(ADAPTER_CLASSES))(
    "%s declares no prototype methods",
    (path, className) => {
      const declaration = sourceFile(path)
        .statements.filter(ts.isClassDeclaration)
        .find(({ name }) => name?.text === className);
      expect(declaration, className).toBeDefined();
      expect(
        declaration?.members.filter(ts.isMethodDeclaration),
        className,
      ).toEqual([]);
    },
  );

  it.each(Object.entries(TARGETED_CLASSES))(
    "%s keeps selected operations as readonly properties",
    (path, { className, operations }) => {
      const declaration = sourceFile(path)
        .statements.filter(ts.isClassDeclaration)
        .find(({ name }) => name?.text === className);
      expect(declaration, className).toBeDefined();

      for (const operation of operations) {
        const members = declaration?.members.filter(
          (member) => member.name?.getText() === operation,
        );
        expect(members, `${className}.${operation}`).toHaveLength(1);
        const member = members?.[0];
        expect(
          member ? ts.isPropertyDeclaration(member) : false,
          `${className}.${operation}`,
        ).toBe(true);
        if (member)
          expect(isReadonly(member), `${className}.${operation}`).toBe(true);
      }
    },
  );
});
