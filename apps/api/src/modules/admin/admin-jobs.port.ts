import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJob,
  PDF_EXPORT_QUEUE_NAME,
  type QueueName,
} from "@weeklyreport/shared";

import type { ObservedTerminalJob } from "../../infrastructure/bullmq/terminal-job-removal.js";

/** Non-credential identity a pdf-export queue payload claims; the durable export row decides whether it is true. */
export interface AdminPdfExportIdentity {
  readonly jobId: string;
  readonly reportId: string;
  readonly requestedBy: string;
  readonly generation: number;
}

export type AdminPdfExportRetryOutcome =
  "retried" | "already-advanced" | "ineligible";

export type AdminJobDomainReference =
  | {
      readonly queue: typeof EMAIL_REMINDER_QUEUE_NAME;
      readonly reminderExecutionId: string | null;
    }
  | {
      readonly queue: typeof PDF_EXPORT_QUEUE_NAME;
      readonly pdfExportIdentity: AdminPdfExportIdentity | null;
    }
  | {
      readonly queue: Exclude<
        QueueName,
        typeof EMAIL_REMINDER_QUEUE_NAME | typeof PDF_EXPORT_QUEUE_NAME
      >;
    };

export interface AdminJobHandle {
  readonly failedJob: FailedJob;
  readonly domainReference: AdminJobDomainReference;
  // Live queue state, read without any lock: the job can change state between
  // this read and a following retry or remove.
  readonly getState: () => Promise<string>;
  // Requeues a failed job. Not idempotent: when two callers race, the loser
  // throws instead of returning a no-op.
  readonly retry: () => Promise<void>;
  // The branch's terminal-only guard replaces main's unconditional remove.
  readonly removeIfTerminal: ObservedTerminalJob["removeIfTerminal"];
}

export interface AdminJobsQueue {
  readonly getFailedCount: () => Promise<number>;
  readonly getFailed: (
    start: number,
    end: number,
  ) => Promise<readonly AdminJobHandle[]>;
  readonly getJob: (id: string) => Promise<AdminJobHandle | undefined>;
}

export interface AdminJobsQueueRegistry {
  readonly get: (name: QueueName) => AdminJobsQueue;
  readonly names: readonly QueueName[];
}
