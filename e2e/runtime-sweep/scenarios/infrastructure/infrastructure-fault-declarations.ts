export const INFRASTRUCTURE_FAULT_IDS = Object.freeze([
  "rate-limit-redis-unavailable",
  "smtp-transport-unavailable",
  "pdf-queue-unavailable",
] as const);

type InfrastructureFaultId = (typeof INFRASTRUCTURE_FAULT_IDS)[number];

type InfrastructureSubsystem =
  "rate-limit-redis" | "smtp-transport" | "pdf-queue";

export type InfrastructureFaultDeclaration = Readonly<{
  readonly faultId: InfrastructureFaultId;
  readonly subsystem: InfrastructureSubsystem;
  readonly testFile: string;
  readonly testName: string;
  readonly operation: string;
  readonly cleanupOracle: string;
  readonly nonMutationOracle: string;
  readonly recoveryOracle: string;
}>;

const declaration = (
  value: InfrastructureFaultDeclaration,
): InfrastructureFaultDeclaration => Object.freeze(value);

export const INFRASTRUCTURE_FAULT_DECLARATIONS = Object.freeze([
  declaration({
    faultId: "rate-limit-redis-unavailable",
    subsystem: "rate-limit-redis",
    testFile:
      "apps/api/src/infrastructure/throttler/rate-limit-readiness.test.ts",
    testName: "falls back once and returns to Redis after a post-start outage",
    operation: "auth rate-limit request",
    cleanupOracle:
      "The test closes its ephemeral HTTP server in a finally block after the bounded request burst.",
    nonMutationOracle:
      "A two-command raw Redis outage becomes one logical store failure without bypassing the local budget or writing product data.",
    recoveryOracle:
      "The same limiter completes a later shared EVALSHA after recovery while the stricter local count still yields five 204 responses and one 429.",
  }),
  declaration({
    faultId: "smtp-transport-unavailable",
    subsystem: "smtp-transport",
    testFile: "apps/api/src/infrastructure/email/email.service.test.ts",
    testName:
      "observes one SMTP transport rejection and recovers on the subsequent send",
    operation: "EmailService.sendMail",
    cleanupOracle:
      "Vitest clears the transport factory and sendMail mocks before each test, keeping the service and transport scoped to this case.",
    nonMutationOracle:
      "The first send rejects and does not reach the post-send success path; no success is claimed for the rejected delivery.",
    recoveryOracle:
      "The same EmailService instance and transport resolve the subsequent send after the one-shot rejection.",
  }),
  declaration({
    faultId: "pdf-queue-unavailable",
    subsystem: "pdf-queue",
    testFile: "apps/api/src/modules/pdf-export/pdf-export.service.test.ts",
    testName:
      "marks the queued row failed when enqueue throws (never a queued row without a job)",
    operation: "PdfExportService.requestPdfExport enqueue",
    cleanupOracle:
      "The test constructs repository and queue doubles per case and does not open a BullMQ or Redis connection.",
    nonMutationOracle:
      "When enqueue rejects, the follow-up status read reports failed rather than leaving a queued row without a job.",
    recoveryOracle:
      "The status read after the rejected enqueue provides terminal failed-state observability for the caller; it does not claim queue recovery.",
  }),
] satisfies readonly InfrastructureFaultDeclaration[]);
